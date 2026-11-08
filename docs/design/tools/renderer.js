// Minimaler Renderer für .dc.html-Dateien (Holes, sc-if, sc-for, dc-import, Events), nur für Screenshots.
(function () {
  const SRC = window.__DC_SOURCES; // name -> text
  const parser = new DOMParser();
  const cache = {};
  const injected = new Set();
  function parse(name) {
    if (cache[name]) return cache[name];
    const text = SRC[name];
    if (!text) throw new Error('missing ' + name);
    const doc = parser.parseFromString(text, 'text/html');
    const xdc = doc.querySelector('x-dc');
    const helmet = xdc.querySelector('helmet');
    if (helmet) {
      helmet.querySelectorAll('style').forEach(s => { const t = s.textContent; if (!injected.has(t)) { injected.add(t); const e = document.createElement('style'); e.textContent = t; document.head.appendChild(e); } });
      helmet.remove();
    }
    const sc = doc.querySelector('script[data-dc-script]');
    let props = {};
    try { props = JSON.parse(sc.getAttribute('data-props') || '{}'); } catch (e) { console.error('props', name, e); }
    const defaults = {};
    Object.keys(props).forEach(k => { if (k[0] !== '$' && props[k] && 'default' in props[k]) defaults[k] = props[k].default; });
    class DCLogic { constructor(p) { this.props = p; this.state = undefined; } setState(s) { this.state = Object.assign({}, this.state, s); } forceUpdate() {} }
    const Component = new Function('DCLogic', sc.textContent + '\n;return Component;')(DCLogic);
    const root = Array.from(xdc.childNodes);
    return (cache[name] = { root, Component, defaults, preview: props.$preview });
  }
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$/.test(path)) return path.slice(1, -1);
    let v = scope;
    for (const part of path.split('.')) { if (v == null) return undefined; v = v[part]; }
    return v;
  }
  const WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;
  function interp(str, scope) { return str.replace(/\{\{([^}]+)\}\}/g, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); }); }
  const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  function renderNodes(nodes, scope, out) { nodes.forEach(n => renderNode(n, scope, out)); }
  function renderNode(n, scope, out) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(interp(n.textContent, scope))); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'sc-if') { const m = (n.getAttribute('value') || '').match(WHOLE); const v = m ? lookup(m[1], scope) : false; if (v) renderNodes(Array.from(n.childNodes), scope, out); return; }
    if (tag === 'sc-for') {
      const m = (n.getAttribute('list') || '').match(WHOLE); const list = (m ? lookup(m[1], scope) : []) || [];
      const as = n.getAttribute('as') || 'item';
      list.forEach((it, i) => { const s = Object.assign(Object.create(scope), { [as]: it, $index: i }); renderNodes(Array.from(n.childNodes), s, out); });
      return;
    }
    if (tag === 'dc-import') {
      const name = n.getAttribute('name'); const p = {};
      Array.from(n.attributes).forEach(a => { if (a.name === 'name' || a.name.startsWith('hint-')) return; const m = a.value.match(WHOLE); p[camel(a.name)] = m ? lookup(m[1], scope) : interp(a.value, scope); });
      out.appendChild(renderComponent(name, p)); return;
    }
    const isSvg = n.namespaceURI === 'http://www.w3.org/2000/svg' || tag === 'svg' || out.namespaceURI === 'http://www.w3.org/2000/svg';
    const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', n.tagName) : document.createElement(tag);
    Array.from(n.attributes).forEach(a => {
      const m = a.value.match(WHOLE);
      if (/^on[a-z]/i.test(a.name)) return; // Events für Screenshots nicht nötig
      if (m) {
        const v = lookup(m[1], scope);
        if (v === false || v == null) { if (/^(aria-|data-)/.test(a.name)) el.setAttribute(a.name, String(v)); return; }
        el.setAttribute(a.name, v === true ? (/^(aria-|data-)/.test(a.name) ? 'true' : '') : String(v));
      } else el.setAttribute(a.name, interp(a.value, scope));
    });
    renderNodes(Array.from(n.childNodes), scope, el);
    out.appendChild(el);
  }
  function renderComponent(name, given) {
    const c = parse(name);
    const props = Object.assign({}, c.defaults, given);
    const inst = new c.Component(props);
    const vals = inst.renderVals();
    const frag = document.createElement('div');
    frag.style.display = 'contents';
    renderNodes(c.root, vals, frag);
    return frag;
  }
  window.__renderDC = function (name, props) { const host = document.getElementById('host'); host.innerHTML = ''; host.appendChild(renderComponent(name, props || {})); };
})();
