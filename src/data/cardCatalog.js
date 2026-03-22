function resolveBackFruit(template, copyIndex, fruits) {
  if (template.backFruit) {
    return template.backFruit;
  }

  return fruits[copyIndex % fruits.length];
}

export function expandCardTemplates(catalog, requiredCards) {
  const templates = catalog.templates ?? [];
  const fruits = catalog.fruits ?? [];

  if (!templates.length) {
    return [];
  }

  const expanded = [];
  let copyIndex = 0;

  while (expanded.length < requiredCards) {
    const template = templates[expanded.length % templates.length];
    const instance = structuredClone(template);

    instance.id = `${template.templateId}__${copyIndex + 1}`;
    instance.templateRef = template.templateId;
    instance.backFruit = resolveBackFruit(template, copyIndex, fruits);

    expanded.push(instance);
    copyIndex += 1;
  }

  return expanded;
}