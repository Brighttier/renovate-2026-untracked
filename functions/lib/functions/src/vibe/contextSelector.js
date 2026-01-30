"use strict";
/**
 * Context Selector (Rule-based, deterministic)
 *
 * Selects relevant HTML sections based on intent.
 * Per newlogic.md: Blast radius control - send ONLY relevant components to AI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectContext = selectContext;
function selectContext(intent, projectIndex) {
    var _a;
    const components = [];
    const constraints = [];
    // Rule-based selection (no AI)
    const target = ((_a = intent.target) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    // Select components based on target
    if (target.includes('nav') || target.includes('header') || intent.intent_type.includes('logo')) {
        if (projectIndex.components['Navbar']) {
            components.push({
                name: 'Navbar',
                html: projectIndex.components['Navbar'].html
            });
        }
    }
    if (target.includes('hero')) {
        if (projectIndex.components['Hero']) {
            components.push({
                name: 'Hero',
                html: projectIndex.components['Hero'].html
            });
        }
    }
    if (target.includes('footer')) {
        if (projectIndex.components['Footer']) {
            components.push({
                name: 'Footer',
                html: projectIndex.components['Footer'].html
            });
        }
    }
    // If no specific target, include all available components (risky, but fallback)
    if (components.length === 0) {
        Object.values(projectIndex.components).forEach(comp => {
            components.push({ name: comp.name, html: comp.html });
        });
    }
    // Add constraints based on intent
    constraints.push('do_not_change_layout_structure');
    constraints.push('preserve_exports');
    if (projectIndex.styleSystem === 'tailwind') {
        constraints.push('tailwind_only');
        constraints.push('no_inline_styles');
    }
    if (intent.risk === 'high') {
        constraints.push('make_minimal_changes');
    }
    return {
        components,
        constraints,
    };
}
//# sourceMappingURL=contextSelector.js.map