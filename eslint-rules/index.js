/**
 * Local ESLint rules.
 *
 * Why local: the obvious choice, `eslint-plugin-react-native-a11y`, still peers
 * on ESLint ≤8 and this project is on ESLint 9 flat config. Installing it with
 * --legacy-peer-deps buys a plugin that can't actually load — a new failure mode
 * in exchange for a rule we can express in ~40 lines. So we express it here.
 */

/** Elements that are interactive and therefore need a spoken name. */
const TOUCHABLES = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
]);

/** Props that give (or knowingly withhold) an accessible name. */
const SATISFYING_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityElementsHidden',
  'importantForAccessibility',
  'aria-label',
  'aria-hidden',
]);

const hasAccessibleName = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Interactive elements must expose an accessible name to VoiceOver/TalkBack.',
    },
    schema: [],
    messages: {
      missing:
        '<{{name}}> has an onPress but no accessibilityLabel. Screen-reader users hear nothing. Add accessibilityLabel (+ accessibilityRole="button"), or mark it decorative with importantForAccessibility="no-hide-descendants".',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = node.name?.name;
        if (!name || !TOUCHABLES.has(name)) return;

        let hasOnPress = false;
        let named = false;
        let spread = false;

        for (const attr of node.attributes) {
          if (attr.type === 'JSXSpreadAttribute') {
            // {...props} could carry the label; don't guess.
            spread = true;
            continue;
          }
          const prop = attr.name?.name;
          if (prop === 'onPress') hasOnPress = true;
          if (SATISFYING_PROPS.has(prop)) named = true;
        }

        // A touchable wrapping a text node usually gets its name from that text,
        // so only flag ones that are both interactive and unnamed.
        if (hasOnPress && !named && !spread) {
          context.report({ node, messageId: 'missing', data: { name } });
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'has-accessible-name': hasAccessibleName,
  },
};
