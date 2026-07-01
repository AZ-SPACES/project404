-- Mini app marketing screenshots (HTTPS image URLs) the developer attaches at submission
-- time. Shown to admins during review so they can preview the app before approving.
-- Ordered list (position) mapped from MiniApp.screenshotUrls via @OrderColumn.
CREATE TABLE IF NOT EXISTS mini_app_screenshots (
    app_id   VARCHAR(100) NOT NULL REFERENCES mini_apps(id) ON DELETE CASCADE,
    position INTEGER      NOT NULL,
    url      TEXT         NOT NULL,
    PRIMARY KEY (app_id, position)
);
