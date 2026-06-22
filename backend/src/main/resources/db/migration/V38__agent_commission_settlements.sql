-- Records out-of-band settlement of the commission AZA owes an agent. Commission is a
-- payable, not e-money: settling it pays the agent via the bank and reduces the accrual
-- on the agent, without touching any wallet — so the safeguarding invariant is untouched.

CREATE TABLE IF NOT EXISTS agent_commission_settlements (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id       UUID NOT NULL,
    amount         NUMERIC(18, 2) NOT NULL,
    bank_reference VARCHAR(255),
    performed_by   UUID,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_settlements_agent ON agent_commission_settlements (agent_id);
