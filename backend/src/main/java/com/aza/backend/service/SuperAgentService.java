package com.aza.backend.service;

import com.aza.backend.dto.superagent.*;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.FloatDistribution;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FloatDistributionRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Super-agent (master-agent) tier. A master agent holds float and pushes it down to the
 * standard agents in its downline, so the network can be topped up without finance minting
 * e-money for every till.
 *
 * <p>Three rules govern everything here:
 *
 * <ol>
 *   <li><b>No margin.</b> The amount that leaves one float wallet is the amount that lands
 *       in the other — no spread, no fee, no commission accrual on either side. A master
 *       agent is a distribution channel, not a counterparty, and this is the invariant the
 *       whole tier was designed around.</li>
 *   <li><b>No minting.</b> Distribution is an internal AGENT_FLOAT-to-AGENT_FLOAT move, so
 *       issued e-money is unchanged and the safeguarding invariant is untouched.</li>
 *   <li><b>Downline only.</b> Every read and every write is scoped to agents whose
 *       {@code parentAgentId} is the calling master. A master can never see or move float
 *       for an agent outside its own downline.</li>
 * </ol>
 *
 * <p>Activation stays with staff: {@link #inviteSubAgent} creates the recruit in PENDING
 * with the parent already set, and the existing maker-checker flow is still what puts them
 * live. A master agent cannot approve its own recruits.
 */
@Service
@RequiredArgsConstructor
public class SuperAgentService {

    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WalletLedger walletLedger;
    private final FloatDistributionRepository floatDistributionRepository;
    private final WalletLocker walletLocker;
    private final UserService userService;

    private static final String CURRENCY = "GHS";

    // ── Entitlement ─────────────────────────────────────────────────────────────

    /**
     * Portal entitlement. Reports "NONE"/"NOT_SUPER" rather than throwing so the shell can
     * render a no-access state instead of an error page.
     */
    public SuperAgentMeResponse me(User user) {
        Optional<Agent> found = agentRepository.findByUserId(user.getId());
        if (found.isEmpty()) {
            return SuperAgentMeResponse.builder().status("NONE").currency(CURRENCY).build();
        }
        Agent agent = found.get();
        if (agent.getTier() != Agent.Tier.SUPER) {
            return SuperAgentMeResponse.builder()
                    .status("NOT_SUPER").tier(agent.getTier().name()).currency(CURRENCY).build();
        }
        String name = displayName(user);
        return SuperAgentMeResponse.builder()
                .status(agent.getStatus().name())
                .tier(agent.getTier().name())
                .code(agent.getCode())
                .businessName(agent.getBusinessName())
                .userName(name)
                .floatBalance(floatBalance(agent.getUserId()))
                .floatLimit(agent.getFloatLimit())
                .subAgentCount(agentRepository.countByParentAgentId(agent.getId()))
                .currency(CURRENCY)
                .build();
    }

    public SuperAgentSummaryResponse summary(User user) {
        Agent master = requireActiveSuper(user);
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        return SuperAgentSummaryResponse.builder()
                .floatBalance(floatBalance(master.getUserId()))
                .downlineFloat(walletRepository.sumFloatForDownline(master.getId()))
                .distributedToday(sum(master, FloatDistribution.Direction.DISTRIBUTE, startOfToday))
                .distributedSevenDays(sum(master, FloatDistribution.Direction.DISTRIBUTE, sevenDaysAgo))
                .distributedThirtyDays(sum(master, FloatDistribution.Direction.DISTRIBUTE, thirtyDaysAgo))
                .recalledThirtyDays(sum(master, FloatDistribution.Direction.RECALL, thirtyDaysAgo))
                .subAgentsTotal(agentRepository.countByParentAgentId(master.getId()))
                .subAgentsActive(agentRepository.countByParentAgentIdAndStatus(master.getId(), Agent.Status.ACTIVE))
                .subAgentsPending(agentRepository.countByParentAgentIdAndStatus(master.getId(), Agent.Status.PENDING))
                .subAgentsSuspended(agentRepository.countByParentAgentIdAndStatus(master.getId(), Agent.Status.SUSPENDED))
                .downlineCommissionAccrued(agentRepository.sumDownlineCommissionAccrued(master.getId()))
                .currency(CURRENCY)
                .build();
    }

    private BigDecimal sum(Agent master, FloatDistribution.Direction direction, LocalDateTime since) {
        return floatDistributionRepository.sumSince(master.getId(), direction, since);
    }

    // ── Float movement ──────────────────────────────────────────────────────────

    /** Pushes float from the master's wallet down to a sub-agent's. */
    @Transactional
    public FloatDistributionResponse distribute(User user, DistributeFloatRequest request) {
        return move(user, request, FloatDistribution.Direction.DISTRIBUTE);
    }

    /** Pulls float back up from a sub-agent, for settling or rebalancing an idle till. */
    @Transactional
    public FloatDistributionResponse recall(User user, DistributeFloatRequest request) {
        return move(user, request, FloatDistribution.Direction.RECALL);
    }

    /**
     * The single float-movement path, shared by both directions so the two can never drift
     * apart on the checks that matter.
     */
    private FloatDistributionResponse move(User user, DistributeFloatRequest request,
                                           FloatDistribution.Direction direction) {
        Agent master = requireActiveSuper(user);

        // Idempotency first, so a retried request returns the original movement rather than
        // making a second one. Scoped to this master: a key that belongs to someone else is
        // rejected rather than replayed, which would leak another downline's movement.
        // Enforced here as well as by bean validation on the DTO: this is the method that moves
        // the money, and it should not be safe to call only because of an annotation upstream.
        String key = normalise(request.getIdempotencyKey());
        if (key == null) {
            throw new AppException("IDEMPOTENCY_KEY_REQUIRED",
                    "An idempotency key is required", HttpStatus.BAD_REQUEST);
        }
        Optional<FloatDistribution> existing = floatDistributionRepository.findByIdempotencyKey(key);
        if (existing.isPresent()) {
            FloatDistribution prior = existing.get();
            if (!prior.getSuperAgentId().equals(master.getId())) {
                throw new AppException("INVALID_IDEMPOTENCY_KEY",
                        "Invalid idempotency key", HttpStatus.CONFLICT);
            }
            return toResponse(prior, master);
        }
        // Two requests carrying the same key can still both get past that read. The UNIQUE index
        // on float_distributions.idempotency_key is what actually decides it: the loser's insert
        // fails and its whole transaction — wallet updates included — rolls back. The duplicate
        // is refused, never applied twice.

        BigDecimal amount = request.getAmount();
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        // Float is money; a fractional pesewa has nowhere to go in a two-decimal ledger.
        if (amount.scale() > 2) {
            throw new AppException("INVALID_AMOUNT",
                    "Amount cannot have more than two decimal places", HttpStatus.BAD_REQUEST);
        }

        Agent sub = resolveSubAgent(master, request);
        if (sub.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("SUB_AGENT_NOT_ACTIVE",
                    "That agent is not active, so float cannot move to or from their till",
                    HttpStatus.CONFLICT);
        }

        // Last gate before any balance changes, and after the idempotency short-circuit so a
        // replayed request does not burn one of the five attempts. Session authentication says
        // who is asking; the passcode says the person is still at the keyboard.
        userService.verifyPasscode(user, request.getPasscode());

        boolean pushingDown = direction == FloatDistribution.Direction.DISTRIBUTE;
        UUID fromUserId = pushingDown ? master.getUserId() : sub.getUserId();
        UUID toUserId = pushingDown ? sub.getUserId() : master.getUserId();
        Agent creditedAgent = pushingDown ? sub : master;

        // Both sides are AGENT_FLOAT wallets; WalletLocker fixes the acquisition order so a
        // simultaneous distribute and recall over the same pair cannot deadlock.
        WalletLocker.Locked locked = walletLocker.lock(
                WalletLocker.agentFloat(fromUserId, "Float wallet not found for the sending agent"),
                WalletLocker.agentFloat(toUserId, "Float wallet not found for the receiving agent"));
        Wallet from = locked.first();
        Wallet to = locked.second();

        if (Boolean.TRUE.equals(from.getFrozen()) || Boolean.TRUE.equals(to.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "One of the float wallets is frozen", HttpStatus.FORBIDDEN);
        }
        if (from.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FLOAT",
                    pushingDown
                            ? "Your float is too low for this distribution"
                            : "That agent's float is too low to recall this amount",
                    HttpStatus.BAD_REQUEST);
        }

        BigDecimal creditedBalance = to.getBalance().add(amount);
        if (creditedAgent.getFloatLimit() != null
                && creditedBalance.compareTo(creditedAgent.getFloatLimit()) > 0) {
            throw new AppException("FLOAT_LIMIT_EXCEEDED",
                    "This movement would push " + (pushingDown ? "that agent's" : "your")
                            + " float above the limit of GHS "
                            + creditedAgent.getFloatLimit().toPlainString(),
                    HttpStatus.CONFLICT);
        }

        // No margin: the same amount is debited and credited. Nothing is skimmed, and no
        // commission accrues on either agent — see the class comment.
        // Both wallets were locked in canonical order above, so this moves them without
        // re-locking. Zero fee is the no-margin rule in code: the amount that leaves the
        // master's float is exactly the amount that lands in the agent's.
        walletLedger.transferLocked(from, to, amount, BigDecimal.ZERO, null);

        Transaction tx = transactionRepository.save(Transaction.builder()
                .senderId(fromUserId)
                .recipientId(toUserId)
                .amount(amount)
                .type(Transaction.TransactionType.FLOAT_DISTRIBUTION)
                .status(Transaction.TransactionStatus.COMPLETED)
                .feeAmount(BigDecimal.ZERO)
                .completedAt(LocalDateTime.now())
                .note(pushingDown ? "Float distributed to agent" : "Float recalled from agent")
                .build());

        FloatDistribution movement = floatDistributionRepository.save(FloatDistribution.builder()
                .superAgentId(master.getId())
                .subAgentId(sub.getId())
                .direction(direction)
                .amount(amount)
                .currency(CURRENCY)
                .transactionId(tx.getId())
                .idempotencyKey(key)
                .note(trimToLength(request.getNote(), 500))
                .performedBy(user.getId())
                .build());

        return toResponse(movement, master);
    }

    // ── Downline ────────────────────────────────────────────────────────────────

    public List<SubAgentResponse> subAgents(User user, String status) {
        Agent master = requireActiveSuper(user);
        List<Agent> downline = agentRepository.findByParentAgentIdOrderByCreatedAtDesc(master.getId());
        if (status != null && !status.isBlank()) {
            Agent.Status wanted = parseStatus(status);
            downline = downline.stream().filter(a -> a.getStatus() == wanted).toList();
        }
        return hydrate(master, downline);
    }

    public SubAgentResponse subAgent(User user, UUID subAgentId) {
        Agent master = requireActiveSuper(user);
        Agent sub = agentRepository.findById(subAgentId)
                .filter(a -> master.getId().equals(a.getParentAgentId()))
                .orElseThrow(this::subAgentNotFound);
        return hydrate(master, List.of(sub)).getFirst();
    }

    /**
     * Nominates an existing AZA user as a sub-agent. The record is created PENDING with the
     * parent set; staff still activate it through maker-checker, so a master agent cannot
     * put its own recruit live.
     */
    @Transactional
    public SubAgentResponse inviteSubAgent(User user, InviteSubAgentRequest request) {
        Agent master = requireActiveSuper(user);
        User recruit = resolveUser(request.getIdentifier());

        if (recruit.getId().equals(user.getId())) {
            throw new AppException("INVALID_SUB_AGENT",
                    "You cannot add yourself to your own downline", HttpStatus.BAD_REQUEST);
        }
        // Adoption of an existing agent is deliberately not supported: it would let a master
        // claim someone else's till without their consent or a compliance review. A recruit
        // must be a user with no agent record, which also makes a parent cycle impossible.
        if (agentRepository.findByUserId(recruit.getId()).isPresent()) {
            throw new AppException("AGENT_EXISTS",
                    "That user already has an agent account or application", HttpStatus.CONFLICT);
        }
        // Agents handle physical cash, so identity must be verified first — the same bar
        // AgentService.apply holds a direct applicant to.
        if (recruit.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC_REQUIRED",
                    "That user must complete identity verification before joining your network",
                    HttpStatus.CONFLICT);
        }

        Agent sub = agentRepository.save(Agent.builder()
                .userId(recruit.getId())
                .status(Agent.Status.PENDING)
                .tier(Agent.Tier.STANDARD)
                .parentAgentId(master.getId())
                .businessName(request.getBusinessName())
                .location(request.getLocation())
                .contactPhone(request.getContactPhone())
                .idNumber(request.getIdNumber())
                .expectedMonthlyVolumeGhs(request.getExpectedMonthlyVolumeGhs())
                .applicationNotes(request.getApplicationNotes())
                .build());

        return hydrate(master, List.of(sub)).getFirst();
    }

    // ── Ledger + reconciliation ─────────────────────────────────────────────────

    public Page<FloatDistributionResponse> distributions(User user, String direction,
                                                         UUID subAgentId, int page, int size) {
        Agent master = requireActiveSuper(user);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));

        Page<FloatDistribution> result;
        if (subAgentId != null) {
            result = floatDistributionRepository
                    .findBySuperAgentIdAndSubAgentIdOrderByCreatedAtDesc(master.getId(), subAgentId, pageable);
        } else if (direction != null && !direction.isBlank()) {
            result = floatDistributionRepository.findBySuperAgentIdAndDirectionOrderByCreatedAtDesc(
                    master.getId(), parseDirection(direction), pageable);
        } else {
            result = floatDistributionRepository
                    .findBySuperAgentIdOrderByCreatedAtDesc(master.getId(), pageable);
        }
        // Resolved in bulk rather than per row: toResponse costs several lookups a movement, which
        // on a twenty-row page was around a hundred round trips for one screen.
        List<FloatDistribution> movements = result.getContent();
        Map<UUID, Agent> agentsById = agentRepository
                .findAllById(movements.stream().map(FloatDistribution::getSubAgentId).distinct().toList())
                .stream().collect(Collectors.toMap(Agent::getId, a -> a, (a, b) -> a));
        Map<UUID, User> usersById = usersFor(List.copyOf(agentsById.values()));

        return result.map(d -> {
            Agent sub = agentsById.get(d.getSubAgentId());
            User u = sub != null ? usersById.get(sub.getUserId()) : null;
            return listResponse(d, sub, u);
        });
    }

    public FloatReconciliationResponse reconciliation(User user) {
        Agent master = requireActiveSuper(user);
        List<Agent> downline = agentRepository.findByParentAgentIdOrderByCreatedAtDesc(master.getId());
        Map<UUID, BigDecimal> floats = floatsByUserId(downline);
        Map<UUID, BigDecimal> net = netByAgentId(master);
        Map<UUID, User> users = usersFor(downline);

        List<FloatReconciliationResponse.Row> rows = new ArrayList<>();
        BigDecimal downlineFloat = BigDecimal.ZERO;
        BigDecimal netDistributed = BigDecimal.ZERO;

        for (Agent a : downline) {
            BigDecimal held = floats.getOrDefault(a.getUserId(), BigDecimal.ZERO);
            BigDecimal pushed = net.getOrDefault(a.getId(), BigDecimal.ZERO);
            downlineFloat = downlineFloat.add(held);
            netDistributed = netDistributed.add(pushed);
            rows.add(FloatReconciliationResponse.Row.builder()
                    .subAgentId(a.getId().toString())
                    .code(a.getCode())
                    .userName(users.containsKey(a.getUserId()) ? displayName(users.get(a.getUserId())) : null)
                    .status(a.getStatus().name())
                    .heldFloat(held)
                    .netDistributed(pushed)
                    .variance(held.subtract(pushed))
                    .build());
        }

        return FloatReconciliationResponse.builder()
                .masterFloat(floatBalance(master.getUserId()))
                .downlineFloat(downlineFloat)
                .netDistributed(netDistributed)
                .variance(downlineFloat.subtract(netDistributed))
                .currency(CURRENCY)
                .rows(rows)
                .build();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * The gate every operation goes through. ROLE_SUPER_AGENT already establishes an ACTIVE
     * SUPER agent at the filter, but the service re-checks so it is safe to call from
     * anywhere and does not depend on a URL prefix for its authorisation.
     */
    private Agent requireActiveSuper(User user) {
        Agent agent = agentRepository.findByUserId(user.getId())
                .orElseThrow(() -> new AppException("NOT_AN_AGENT",
                        "This account is not registered as an agent", HttpStatus.FORBIDDEN));
        if (agent.getTier() != Agent.Tier.SUPER) {
            throw new AppException("NOT_A_SUPER_AGENT",
                    "This account is not a super agent", HttpStatus.FORBIDDEN);
        }
        if (agent.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("AGENT_NOT_ACTIVE",
                    "Your agent account is not active", HttpStatus.FORBIDDEN);
        }
        return agent;
    }

    /**
     * Resolves the movement's counterparty and proves it belongs to this master. Both the
     * "no such agent" and the "not yours" cases return the same 404, so the endpoint cannot
     * be used to probe which till codes exist.
     */
    private Agent resolveSubAgent(Agent master, DistributeFloatRequest request) {
        String code = normalise(request.getSubAgentCode());
        String id = normalise(request.getSubAgentId());
        if (code == null && id == null) {
            throw new AppException("SUB_AGENT_REQUIRED",
                    "Name the agent by till code or id", HttpStatus.BAD_REQUEST);
        }

        Optional<Agent> found;
        if (id != null) {
            UUID parsed;
            try {
                parsed = UUID.fromString(id);
            } catch (IllegalArgumentException e) {
                throw subAgentNotFound();
            }
            found = agentRepository.findById(parsed);
        } else {
            found = agentRepository.findByCode(code.toUpperCase());
        }

        return found
                .filter(a -> master.getId().equals(a.getParentAgentId()))
                .orElseThrow(this::subAgentNotFound);
    }

    private AppException subAgentNotFound() {
        return new AppException("SUB_AGENT_NOT_FOUND",
                "No agent in your network matches that", HttpStatus.NOT_FOUND);
    }

    private User resolveUser(String identifier) {
        String candidate = identifier.startsWith("@") ? identifier.substring(1) : identifier;
        return userRepository.findByEmailOrPhoneNumber(identifier, identifier)
                .or(() -> userRepository.findByUsername(candidate))
                .orElseThrow(() -> new AppException("USER_NOT_FOUND",
                        "No AZA user matches that", HttpStatus.NOT_FOUND));
    }

    /** Fills in balances and lifetime position for a batch of agents in one pass. */
    private List<SubAgentResponse> hydrate(Agent master, List<Agent> downline) {
        Map<UUID, BigDecimal> floats = floatsByUserId(downline);
        Map<UUID, BigDecimal> net = netByAgentId(master);
        Map<UUID, User> users = usersFor(downline);
        return downline.stream().map(a -> {
                    User u = users.get(a.getUserId());
                    return SubAgentResponse.builder()
                            .id(a.getId().toString())
                            .userId(a.getUserId().toString())
                            .code(a.getCode())
                            .status(a.getStatus().name())
                            .userName(u != null ? displayName(u) : null)
                            .userPhone(u != null ? u.getPhoneNumber() : null)
                            .location(a.getLocation())
                            .businessName(a.getBusinessName())
                            .floatBalance(floats.getOrDefault(a.getUserId(), BigDecimal.ZERO))
                            .floatLimit(a.getFloatLimit())
                            .commissionAccruedGhs(a.getCommissionAccruedGhs())
                            .netFloatReceived(net.getOrDefault(a.getId(), BigDecimal.ZERO))
                            .createdAt(a.getCreatedAt() != null ? a.getCreatedAt().toString() : null)
                            .build();
                })
                .toList();
    }

    /**
     * Users for a whole downline in one query. Read per agent this was two lookups each — the
     * name and the phone — so a fifty-till network spent a hundred round trips rendering one
     * roster.
     */
    private Map<UUID, User> usersFor(List<Agent> agents) {
        if (agents.isEmpty()) {
            return Map.of();
        }
        List<UUID> userIds = agents.stream().map(Agent::getUserId).toList();
        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
    }

    private Map<UUID, BigDecimal> floatsByUserId(List<Agent> agents) {
        if (agents.isEmpty()) {
            return Map.of();
        }
        List<UUID> userIds = agents.stream().map(Agent::getUserId).toList();
        return walletRepository.findAgentFloatWallets(userIds).stream()
                .collect(Collectors.toMap(Wallet::getUserId, Wallet::getBalance, (a, b) -> a));
    }

    private Map<UUID, BigDecimal> netByAgentId(Agent master) {
        Map<UUID, BigDecimal> net = new HashMap<>();
        for (Object[] row : floatDistributionRepository.netPerSubAgent(
                master.getId(), FloatDistribution.Direction.DISTRIBUTE)) {
            net.put((UUID) row[0], (BigDecimal) row[1]);
        }
        return net;
    }

    private BigDecimal floatBalance(UUID userId) {
        return walletRepository.findByUserIdAndType(userId, Wallet.WalletType.AGENT_FLOAT)
                .map(Wallet::getBalance).orElse(BigDecimal.ZERO);
    }

    private String userName(UUID userId) {
        return userRepository.findById(userId).map(SuperAgentService::displayName).orElse(null);
    }

    private static String displayName(User u) {
        String full = ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                + (u.getLastName() != null ? u.getLastName() : "")).trim();
        return full.isBlank() ? u.getUsername() : full;
    }

    /**
     * A ledger row. The float balances are deliberately left null here: they are the balances
     * <em>now</em>, not as at the movement, so attaching them to a historical row would be a
     * misleading number as well as an expensive one. They are populated only on
     * {@link #toResponse}, which answers the movement that just happened.
     */
    private FloatDistributionResponse listResponse(FloatDistribution d, Agent sub, User subUser) {
        return FloatDistributionResponse.builder()
                .id(d.getId().toString())
                .direction(d.getDirection().name())
                .amount(d.getAmount())
                .currency(d.getCurrency())
                .subAgentId(d.getSubAgentId().toString())
                .subAgentCode(sub != null ? sub.getCode() : null)
                .subAgentName(subUser != null ? displayName(subUser) : null)
                .note(d.getNote())
                .transactionId(d.getTransactionId() != null ? d.getTransactionId().toString() : null)
                .createdAt(d.getCreatedAt() != null ? d.getCreatedAt().toString() : null)
                .build();
    }

    /** The full answer for a single movement, including where both floats stand afterwards. */
    private FloatDistributionResponse toResponse(FloatDistribution d, Agent master) {
        Optional<Agent> sub = agentRepository.findById(d.getSubAgentId());
        return FloatDistributionResponse.builder()
                .id(d.getId().toString())
                .direction(d.getDirection().name())
                .amount(d.getAmount())
                .currency(d.getCurrency())
                .subAgentId(d.getSubAgentId().toString())
                .subAgentCode(sub.map(Agent::getCode).orElse(null))
                .subAgentName(sub.map(a -> userName(a.getUserId())).orElse(null))
                .note(d.getNote())
                .transactionId(d.getTransactionId() != null ? d.getTransactionId().toString() : null)
                .superAgentFloatBalance(floatBalance(master.getUserId()))
                .subAgentFloatBalance(sub.map(a -> floatBalance(a.getUserId())).orElse(BigDecimal.ZERO))
                .createdAt(d.getCreatedAt() != null ? d.getCreatedAt().toString() : null)
                .build();
    }

    private Agent.Status parseStatus(String status) {
        try {
            return Agent.Status.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_STATUS",
                    "Status must be one of PENDING, ACTIVE, SUSPENDED, REJECTED", HttpStatus.BAD_REQUEST);
        }
    }

    private FloatDistribution.Direction parseDirection(String direction) {
        try {
            return FloatDistribution.Direction.valueOf(direction.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_DIRECTION",
                    "Direction must be DISTRIBUTE or RECALL", HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalise(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String trimToLength(String value, int max) {
        String v = normalise(value);
        return v == null || v.length() <= max ? v : v.substring(0, max);
    }
}
