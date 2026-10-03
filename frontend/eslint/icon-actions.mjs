// Catch bare icon actions before they bypass IconButton's required name/tooltip.
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      useIconButton: '图标操作必须使用 IconButton，并提供 label（统一 Tooltip 与可访问名称）。',
      visibleName: '带文字名称的 IconButton 必须声明 showTooltip={false}，响应式或折叠入口按文字可见状态控制。',
    },
  },
  create(context) {
    const icons = new Set();
    const iconOnly = node => {
      if (!node) return true;
      if (node.type === 'JSXText') return !node.value.trim() || /^[\d+−-]+$/.test(node.value.trim());
      if (node.type === 'JSXExpressionContainer') return iconOnly(node.expression);
      if (node.type === 'JSXEmptyExpression') return true;
      if (node.type === 'Literal') return typeof node.value !== 'string' || !/[\p{L}]/u.test(node.value);
      if (node.type === 'ConditionalExpression') return iconOnly(node.consequent) && iconOnly(node.alternate);
      if (node.type === 'LogicalExpression') return iconOnly(node.right);
      if (node.type === 'MemberExpression') return /count|length/i.test(node.property.name || '');
      if (node.type !== 'JSXElement') return false;
      const name = node.openingElement.name.name;
      return icons.has(name) || (name === 'span' && node.children.every(iconOnly));
    };
    const hasIcon = node => {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'JSXOpeningElement' && icons.has(node.name.name)) return true;
      return (context.sourceCode.visitorKeys[node.type] || []).some(key => {
        const value = node[key];
        return Array.isArray(value) ? value.some(hasIcon) : hasIcon(value);
      });
    };
    const hasActionText = node => {
      if (!node || typeof node !== 'object') return false;
      if (node.type === 'JSXElement' && icons.has(node.openingElement.name.name)) return false;
      if (node.type === 'JSXText') return /[\p{L}]/u.test(node.value);
      if (node.type === 'Literal') return typeof node.value === 'string' && /[\p{L}]/u.test(node.value);
      if (node.type === 'CallExpression') return node.callee.type === 'Identifier' && node.callee.name === 't';
      if (node.type === 'MemberExpression') return /^(label|name|displayName|email)$/.test(node.property.name || '');
      if (node.type === 'ConditionalExpression') return hasActionText(node.consequent) || hasActionText(node.alternate);
      if (node.type === 'LogicalExpression') return hasActionText(node.right);
      if (node.type === 'BinaryExpression') return false;
      // Attributes and comments do not constitute visible action names.
      if (node.type === 'JSXElement' || node.type === 'JSXFragment') return node.children.some(hasActionText);
      return (context.sourceCode.visitorKeys[node.type] || []).some(key => {
        const value = node[key];
        return Array.isArray(value) ? value.some(hasActionText) : hasActionText(value);
      });
    };
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'lucide-react') return;
        for (const specifier of node.specifiers) icons.add(specifier.local.name);
      },
      JSXElement(node) {
        if (context.sourceCode.getAncestors(node).some(parent =>
          parent.type === 'JSXElement' && parent.openingElement.name.name === 'IconButton')) return;
        const opening = node.openingElement;
        const name = opening.name.name;
        if (name === 'IconButton' && node.children.some(hasActionText)) {
          const policy = opening.attributes.find(attr => attr.name?.name === 'showTooltip');
          const alwaysEnabled = policy && (!policy.value ||
            (policy.value.type === 'JSXExpressionContainer' && policy.value.expression.type === 'Literal' && policy.value.expression.value === true));
          if (!policy || alwaysEnabled) context.report({ node: opening, messageId: 'visibleName' });
        }
        const interactive = name === 'button' || name === 'a' ||
          (name === 'div' && opening.attributes.some(attr => attr.name?.name === 'onClick'));
        if (interactive && hasIcon(node) && node.children.every(iconOnly)) {
          context.report({ node: opening, messageId: 'useIconButton' });
        }
      },
    };
  },
};
