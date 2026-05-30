// manamap build handoff — vanilla render from window.HANDOFF.
(function () {
  const H = window.HANDOFF;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  // ── meta row ──
  H.meta.forEach(m => {
    const c = el('div', 'meta');
    c.appendChild(el('b', null, m.k));
    c.appendChild(el('span', null, m.v));
    $('metarow').appendChild(c);
  });

  // ── stack ──
  H.stack.forEach(s => {
    const c = el('div', 'card');
    c.appendChild(el('div', 'lyr', s.layer));
    c.appendChild(el('div', 'choice', s.choice));
    c.appendChild(el('div', 'why', s.why));
    const tags = el('div', 'taglist');
    s.tags.forEach(t => tags.appendChild(el('span', 'tag', t)));
    c.appendChild(tags);
    c.appendChild(el('div', 'alt', s.alt));
    $('stackgrid').appendChild(c);
  });

  // ── layers ──
  H.layers.forEach(l => {
    const row = el('div', 'layer');
    row.appendChild(el('div', 'lname', l.name));
    const bits = el('div', 'lbits');
    l.bits.forEach(b => bits.appendChild(el('span', 'lbit', b)));
    row.appendChild(bits);
    $('layers').appendChild(row);
  });

  // ── callouts ──
  H.callouts.forEach(co => {
    const c = el('div', 'callout ' + co.kind);
    c.appendChild(el('div', 'ico', co.ico));
    const body = el('div');
    body.appendChild(el('div', 't', co.t));
    body.appendChild(el('div', 'd', co.d));
    c.appendChild(body);
    $('callouts').appendChild(c);
  });

  // ── data model ──
  H.tables.forEach(t => {
    const c = el('div', 'tbl');
    const nm = el('div', 'tname');
    nm.appendChild(document.createTextNode(t.name));
    if (t.note) nm.appendChild(el('span', 'tnote', t.note));
    c.appendChild(nm);
    t.fields.forEach(([f, ty]) => {
      const row = el('div', 'field');
      const isFk = /fk|pk/.test(ty);
      const fn = el('span', 'fname' + (isFk ? ' fk' : ''));
      fn.textContent = f;
      row.appendChild(fn);
      if (ty) { const tt = el('span', 'ftype'); tt.textContent = ty; row.appendChild(tt); }
      c.appendChild(row);
    });
    $('tables').appendChild(c);
  });

  // ── api ──
  H.api.forEach(g => {
    const grp = el('div', 'apigroup');
    const gn = el('div', 'gname');
    const dot = el('span', 'dot'); dot.style.background = g.color; gn.appendChild(dot);
    gn.appendChild(document.createTextNode(g.group));
    grp.appendChild(gn);
    const routes = el('div', 'routes');
    g.routes.forEach(([verb, path, desc]) => {
      const r = el('div', 'route');
      r.appendChild(el('span', 'verb ' + verb, verb));
      const p = el('span', 'path'); p.textContent = path; r.appendChild(p);
      r.appendChild(el('span', 'rdesc', desc));
      routes.appendChild(r);
    });
    grp.appendChild(routes);
    $('api-groups').appendChild(grp);
  });

  // ── phases & milestones ──
  H.phases.forEach(ph => {
    const head = el('div', 'phasehead');
    head.appendChild(el('span', 'ptag', ph.ptag));
    head.appendChild(el('h3', null, ph.title));
    head.appendChild(el('span', 'pgoal', ph.goal));
    $('phases').appendChild(head);

    ph.milestones.forEach(m => {
      const ms = el('div', 'ms');

      const mh = el('div', 'mhead');
      mh.appendChild(el('span', 'mcode', m.code));
      const mb = el('div');
      mb.appendChild(el('div', 'mtitle', m.title));
      mb.appendChild(el('div', 'mgoal', m.goal));
      if (m.deps) mb.appendChild(el('div', 'mdeps', 'needs: ' + m.deps));
      mh.appendChild(mb);
      ms.appendChild(mh);

      // prompt box
      const box = el('div', 'promptbox');
      const top = el('div', 'ptop');
      top.appendChild(el('span', 'plabel', m.code + ' · build prompt'));
      const btn = el('button', 'copybtn');
      btn.innerHTML = '<span class="ci">⧉</span> Copy';
      box.dataset.prompt = m.prompt;
      btn.addEventListener('click', () => {
        const ok = () => {
          btn.classList.add('done'); btn.innerHTML = '✓ Copied';
          setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = '<span class="ci">⧉</span> Copy'; }, 1600);
        };
        const fallback = () => {
          const ta = document.createElement('textarea');
          ta.value = m.prompt; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); ok(); } catch (e) { /* noop */ }
          document.body.removeChild(ta);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(m.prompt).then(ok).catch(fallback);
        } else { fallback(); }
      });
      top.appendChild(btn);
      box.appendChild(top);
      const pre = el('pre'); const code = el('code'); code.textContent = m.prompt; pre.appendChild(code); box.appendChild(pre);
      ms.appendChild(box);

      // lists
      const lists = el('div', 'mlists');
      const d = el('div', 'mlist');
      d.appendChild(el('div', 'lh', 'Deliverables'));
      const dul = el('ul'); m.deliverables.forEach(x => { const li = el('li'); li.textContent = x; dul.appendChild(li); }); d.appendChild(dul);
      lists.appendChild(d);
      const a = el('div', 'mlist acc');
      a.appendChild(el('div', 'lh', 'Acceptance'));
      const aul = el('ul'); m.acceptance.forEach(x => { const li = el('li'); li.textContent = x; aul.appendChild(li); }); a.appendChild(aul);
      lists.appendChild(a);
      ms.appendChild(lists);

      $('phases').appendChild(ms);
    });
  });

  // ── risks ──
  H.risks.forEach(r => {
    const c = el('div', 'risk');
    const t = el('div', 'rt');
    t.appendChild(document.createTextNode(r.ico + ' '));
    t.appendChild(document.createTextNode(r.t));
    c.appendChild(t);
    c.appendChild(el('div', 'rd', r.d));
    $('risks').appendChild(c);
  });
})();
