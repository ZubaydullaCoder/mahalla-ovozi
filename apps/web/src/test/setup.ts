const nativeGetComputedStyle = window.getComputedStyle.bind(window)

// jsdom intentionally does not implement pseudo-element style inspection.
// Ant Design uses it for layout probes, while these tests do not assert
// pseudo-element styles. Preserve normal style lookup and safely ignore only
// that unsupported optional argument.
window.getComputedStyle = ((element: Element) => nativeGetComputedStyle(element)) as typeof window.getComputedStyle
