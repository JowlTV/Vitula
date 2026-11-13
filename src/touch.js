// Teclado virtual para celular/tablet. Não altera a lógica do jogo: cada botão dispara
// os mesmos eventos de teclado (keydown/keyup) que o teclado físico, usando as teclas
// configuradas em Opções. Pode ser mostrado/ocultado pelo botão ⌨ (preferência salva).
(function () {
  const FALLBACK = {
    up: ["W", "UP"], down: ["S", "DOWN"], left: ["A", "LEFT"], right: ["D", "RIGHT"],
    skill1: ["ONE"], skill2: ["TWO"], skill3: ["THREE"], skill4: ["FOUR"],
    potion1: ["FIVE"], potion2: ["SIX"], attack: ["SPACE"], interact: ["E"],
    bag: ["I"], recall: ["H"], map: ["TAB"], autoAttack: ["R"], pause: ["ESC"],
  };
  const FIXED = { ENTER: "ENTER", ESC: "ESC", U: "U" };
  const PREF = "vitula_touch_v1";

  // Nome da tecla (Phaser) para uma ação, respeitando remapeamento nas Opções.
  function keyName(action) {
    const cfg = (window.Settings && Settings.data.keys && Settings.data.keys[action]) || [];
    const name = cfg.find(n => n) || (FALLBACK[action] || []).find(n => n);
    return name;
  }
  function codeOf(name) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    return K[name];
  }

  // Dispara um keydown/keyup no window, que é onde o Phaser escuta o teclado.
  const held = new Map();
  function fire(type, code, name) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(ev, {
      keyCode: { get: () => code }, which: { get: () => code },
      key: { get: () => name }, code: { get: () => name },
    });
    window.dispatchEvent(ev);
  }
  function press(name) {
    const code = codeOf(name);
    if (code === undefined) return;
    held.set(code, (held.get(code) || 0) + 1);
    if (held.get(code) === 1) fire("keydown", code, name);
  }
  function release(name) {
    const code = codeOf(name);
    if (code === undefined || !held.has(code)) return;
    const n = held.get(code) - 1;
    if (n <= 0) { held.delete(code); fire("keyup", code, name); } else held.set(code, n);
  }
  function releaseAll() { for (const code of [...held.keys()]) fire("keyup", code, ""); held.clear(); }
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });

  // Botões: [rótulo, ação ou tecla fixa, tipo: "hold" (segura) ou "tap" (toque único), título]
  const layout = () => ({
    pad: [
      ["▲", "up", "hold", t("touch_up"), 2, 1], ["◀", "left", "hold", t("touch_left"), 1, 2],
      ["▶", "right", "hold", t("touch_right"), 3, 2], ["▼", "down", "hold", t("touch_down"), 2, 3],
    ],
    skills: [
      ["1", "skill1", "tap", t("touch_frontal")], ["2", "skill2", "tap", t("touch_magic2")],
      ["3", "skill3", "tap", t("touch_aoe")], ["4", "skill4", "tap", t("touch_aura")],
      ["5", "potion1", "tap", t("touch_pot1")], ["6", "potion2", "tap", t("touch_pot2")],
    ],
    main: [
      ["ATQ", "attack", "tap", t("touch_attack"), "big"], ["E", "interact", "tap", t("touch_interact"), "mid"],
      ["OK", "ENTER", "tap", t("touch_confirm")],
    ],
    util: [
      ["Esc", "ESC", "tap", t("touch_pause")], [t("touch_bag"), "bag", "tap", t("touch_bag")],
      [t("attributes"), "U", "tap", t("touch_attrs")], [t("touch_map"), "map", "tap", t("touch_map")], ["Auto", "autoAttack", "tap", t("touch_auto")], [t("touch_recall"), "recall", "tap", t("touch_recall")],
    ],
  });;

  function button(label, action, type, title, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.className = "vt-btn" + (cls ? " vt-" + cls : "");
    b.setAttribute("aria-label", title);
    const name = () => (FIXED[action] || keyName(action));
    if (type === "hold") {
      b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) {} b.classList.add("on"); press(name()); });
      const up = e => { e.preventDefault(); b.classList.remove("on"); release(name()); };
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
    } else {
      b.addEventListener("pointerdown", e => {
        e.preventDefault(); b.classList.add("on");
        const n = name(); press(n);
        setTimeout(() => { release(n); b.classList.remove("on"); }, 90);
      });
    }
    // Impede que o toque chegue ao canvas do Phaser (ex.: clique para mover, roda do mouse).
    b.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });
    return b;
  }

  function build() {
    const LAYOUT = layout();
    const old = document.getElementById("vt"); if (old) old.remove();   // reconstrói ao trocar de idioma
    // Tamanho dos botões acompanha a altura da tela (paisagem no celular: ~40 px; tablet: até 62 px).
    // Tudo fica longe do entalhe (safe-area) e fora do topo, onde ficam vida, minimapa e janelas.
    const css = `
      #vt { --s: clamp(38px, 10.5vmin, 62px); --g: 5px; --L: calc(env(safe-area-inset-left) + 10px); --R: calc(env(safe-area-inset-right) + 10px); --B: calc(env(safe-area-inset-bottom) + 8px);
        position: fixed; inset: 0; pointer-events: none; z-index: 50; font-family: "Pixelify", monospace; user-select: none; -webkit-user-select: none; }
      #vt .vt-layer { position: absolute; inset: 0; pointer-events: none; }
      #vt .vt-btn { pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent;
        background: rgba(20,16,26,.45); color: #e8e1d3; border: 1px solid rgba(201,162,74,.6); border-radius: 50%;
        font-size: calc(var(--s) * .34); font-weight: 700; display: flex; align-items: center; justify-content: center;
        width: var(--s); height: var(--s); box-shadow: 0 2px 0 rgba(0,0,0,.45); padding: 0; }
      #vt .vt-btn.on { background: rgba(139,30,45,.85); transform: translateY(1px); }
      #vt .vt-small { width: calc(var(--s) * .86); height: calc(var(--s) * .86); }
      #vt .vt-util { width: calc(var(--s) * 1.25); height: calc(var(--s) * .62); border-radius: 8px; font-size: calc(var(--s) * .27); }
      #vt .vt-big { width: calc(var(--s) * 1.55); height: calc(var(--s) * 1.55); font-size: calc(var(--s) * .38); border-color: #c9a24a; background: rgba(60,20,24,.55); }
      #vt .vt-mid { width: calc(var(--s) * 1.05); height: calc(var(--s) * 1.05); }
      /* direcional: canto inferior esquerdo */
      #vt .pad { position: absolute; left: var(--L); bottom: var(--B); display: grid; grid-template-columns: repeat(3, var(--s)); grid-template-rows: repeat(3, var(--s)); gap: var(--g); }
      #vt .pad .vt-btn { border-radius: 10px; }
      /* ataque e usar: canto inferior direito; habilidades e poções num arco acima */
      #vt .main { position: absolute; right: var(--R); bottom: var(--B); display: flex; flex-direction: row-reverse; gap: 8px; align-items: flex-end; }
      #vt .skills { position: absolute; right: var(--R); bottom: calc(var(--B) + var(--s) * 1.55 + 10px); display: grid; grid-template-columns: repeat(3, calc(var(--s) * .86)); gap: var(--g); direction: rtl; }
      /* atalhos (pausa, mochila, mapa, automático): coluna no alto da lateral esquerda, sob o botão ⌨ */
      #vt .util { position: absolute; left: var(--L); top: calc(env(safe-area-inset-top) + 10px + var(--s) * .62 + 8px); display: flex; flex-direction: column; gap: var(--g); }
      #vt .toggle-wrap { position: absolute; inset: 0; pointer-events: none; }
      #vt .toggle { position: absolute; left: var(--L); top: calc(env(safe-area-inset-top) + 10px); pointer-events: auto; width: calc(var(--s) * 1.25); height: calc(var(--s) * .62); }
      #vt.hidden .vt-layer { display: none; }
      #vt.hidden .toggle { opacity: .7; }
      /* telas bem baixas: atalhos em linha no rodapé, entre direcional e ataque */
      @media (max-height: 340px) {
        #vt .util { top: auto; transform: none; bottom: var(--B); left: calc(var(--L) + var(--s) * 3 + 24px); flex-direction: row; }
        #vt .toggle { top: auto; bottom: calc(var(--B) + var(--s) * .7 + 8px); left: calc(var(--L) + var(--s) * 3 + 24px); }
      }
    `;
    if (!document.getElementById("vt-style")) { const style = document.createElement("style"); style.id = "vt-style"; style.textContent = css; document.head.appendChild(style); }

    const root = document.createElement("div");
    root.id = "vt";
    const layer = document.createElement("div");
    layer.className = "vt-layer";

    const pad = document.createElement("div"); pad.className = "pad";
    LAYOUT.pad.forEach(([l, a, t, ti, c, r]) => { const b = button(l, a, t, ti); b.style.gridColumn = c; b.style.gridRow = r; pad.appendChild(b); });

    const skills = document.createElement("div"); skills.className = "skills";
    LAYOUT.skills.forEach(([l, a, t, ti]) => skills.appendChild(button(l, a, t, ti, "small")));

    const main = document.createElement("div"); main.className = "main";
    LAYOUT.main.forEach(([l, a, t, ti, size]) => main.appendChild(button(l, a, t, ti, size || "mid")));

    const util = document.createElement("div"); util.className = "util";
    LAYOUT.util.forEach(([l, a, t, ti]) => util.appendChild(button(l, a, t, ti, "util")));

    layer.append(pad, skills, main, util);

    // Botão de mostrar/ocultar (sempre visível, para não ficar preso escondido).
    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "vt-btn vt-util toggle"; toggle.textContent = "⌨";
    toggle.title = t("touch_toggle"); toggle.setAttribute("aria-label", t("touch_toggle_aria"));
    toggle.style.pointerEvents = "auto";
    const wrap = document.createElement("div"); wrap.className = "toggle-wrap"; wrap.appendChild(toggle);

    root.append(layer, wrap);
    document.body.appendChild(root);

    const setVisible = on => { root.classList.toggle("hidden", !on); try { localStorage.setItem(PREF, on ? "1" : "0"); } catch (e) {} };
    toggle.addEventListener("pointerdown", e => { e.preventDefault(); setVisible(root.classList.contains("hidden")); });
    toggle.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });

    // Padrão: mostrar em aparelhos com toque; ?touch=1 força, ?touch=0 esconde.
    const q = new URLSearchParams(location.search).get("touch");
    let pref = null; try { pref = localStorage.getItem(PREF); } catch (e) {}
    const touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    const on = q === "1" ? true : q === "0" ? false : pref !== null ? pref === "1" : touch;
    root.classList.toggle("hidden", !on);
  }

  // Monta os controles quando a página carregar (o Phaser já está disponível nesse ponto).
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  window.addEventListener("vitula-lang", build);
})();
