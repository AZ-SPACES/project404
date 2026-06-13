package com.aza.backend.service;

import java.util.List;
import java.util.Optional;

/**
 * Server-side mirror of the mobile MINI_APP_REGISTRY
 * (aza/src/features/hub/miniapps/registry.ts). Keep the two in sync when a
 * mini app is added or removed so admins can manage it from the dashboard.
 */
public final class MiniAppCatalog {

    public record Entry(String id, String name, String category, String description) {}

    public static final List<Entry> ALL = List.of(
            new Entry("aza_business", "Aza Business", "Business", "Accept payments, manage payouts and API keys"),
            new Entry("aza_developer", "AZA Developer", "Business", "Manage OAuth apps and Sign in with AZA"),
            new Entry("play_2048", "2048", "Games", "Join the numbers and get to the 2048 tile!"),
            new Entry("snake", "Snake", "Games", "Eat apples to grow your snake and avoid crashing into walls or yourself!"),
            new Entry("connect4", "Connect 4", "Games", "Connect 4 in a row to win!"),
            new Entry("radio", "Radio", "Entertainment", "Listen to the radio"),
            new Entry("notepad", "Notepad", "Productivity", "Take notes"),
            new Entry("cedirates", "CediRates", "Finance", "Live exchange rates and fuel prices"),
            new Entry("salifu_and_master", "Salifu and Master", "Games", "Play Salifu and Master"));

    public static Optional<Entry> find(String id) {
        return ALL.stream().filter(e -> e.id().equals(id)).findFirst();
    }

    public static String displayName(String id) {
        return find(id).map(Entry::name).orElse(id);
    }

    private MiniAppCatalog() {}
}
