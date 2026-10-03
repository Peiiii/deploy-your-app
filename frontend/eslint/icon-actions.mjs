// Catch bare icon actions before they bypass IconButton's required name/tooltip.
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: { useIconButton: '图标操作必须使用 IconButton，并提供 label（统一 Tooltip 与可访问名称）。' },
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
        const interactive = name === 'button' || name === 'a' ||
          (name === 'div' && opening.attributes.some(attr => attr.name?.name === 'onClick'));
        if (interactive && hasIcon(node) && node.children.every(iconOnly)) {
          context.report({ node: opening, messageId: 'useIconButton' });
        }
      },
    };
  },
};
