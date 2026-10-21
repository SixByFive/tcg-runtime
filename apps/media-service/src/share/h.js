// Tiny element builder for satori (no JSX in this service).
// Satori requires `display: flex` on any element with more than one child,
// so we add it automatically in that case.

export function h(type, style = {}, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  const needsFlex = kids.length > 1 || kids.some((c) => typeof c === 'object');
  return {
    type,
    props: {
      style: needsFlex && !style.display ? { display: 'flex', ...style } : style,
      children: kids.length === 1 ? kids[0] : kids,
    },
  };
}

export function img(src, style = {}) {
  return { type: 'img', props: { src, style } };
}
