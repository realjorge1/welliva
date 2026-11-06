/**
 * plugins/withNotificationLargeIcon.js
 *
 * Puts the full-colour Gozlin diamond on every Android notification.
 *
 * Android draws a notification's SMALL icon (status bar, header row) from its
 * alpha channel only, so that one can only ever be a one-colour silhouette —
 * expo-notifications' own `icon` option covers it. The LARGE icon is the
 * picture beside the text, and it is drawn in full colour. expo-notifications
 * already reads a default one from the manifest for every local notification
 * (`expo.modules.notifications.large_notification_icon`, see
 * ExpoNotificationBuilder / NotificationContent.getImage), but its config plugin
 * has no option to set it yet — so this one does: it copies the image into the
 * app's resources and adds the meta-data entry.
 *
 * Native: takes effect on the next EAS build, never on a Metro reload.
 */
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const META_LARGE_ICON = "expo.modules.notifications.large_notification_icon";
const RESOURCE_NAME = "notification_large_icon";

function withNotificationLargeIcon(config, props = {}) {
  const icon = props.icon;
  if (!icon) {
    throw new Error("withNotificationLargeIcon: pass { icon: './path/to/image.png' }");
  }

  // drawable-nodpi: decoded at its own size; Android scales it to the slot.
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const src = path.resolve(cfg.modRequest.projectRoot, icon);
      const dir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res/drawable-nodpi");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, path.join(dir, `${RESOURCE_NAME}.png`));
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      META_LARGE_ICON,
      `@drawable/${RESOURCE_NAME}`,
      "resource",
    );
    return cfg;
  });

  return config;
}

module.exports = withNotificationLargeIcon;
