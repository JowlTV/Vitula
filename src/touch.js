// Teclado virtual para celular/tablet. Não altera a lógica do jogo: cada botão dispara
// os mesmos eventos de teclado (keydown/keyup) que o teclado físico, usando as teclas
// configuradas em Opções. Pode ser mostrado/ocultado pelo botão ⌨ (preferência salva).
(function () {
  const FALLBACK = {
    up: ["W", "UP"], down: ["S", "DOWN"], left: ["A", "LEFT"], right: ["D", "RIGHT"],
    skill1: ["ONE"], skill2: ["TWO"], skill3: ["THREE"], skill4: ["FOUR"],
    potion1: ["FIVE"], potion2: ["SIX"], attack: ["SPACE"], interact: ["E"],
    bag: ["I"], map: ["TAB"], autoAttack: ["R"], pause: ["ESC"],
  };
  const FIXED = { ENTER: "ENTER", ESC: "ESC" };
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
  const LAYOUT = {
    pad: [
      ["▲", "up", "hold", "Cima", 2, 1], ["◀", "left", "hold", "Esquerda", 1, 2],
      ["▶", "right", "hold", "Direita", 3, 2], ["▼", "down", "hold", "Baixo", 2, 3],
    ],
    skills: [
      ["1", "skill1", "tap", "Golpe Frontal"], ["2", "skill2", "tap", "Magia 2"],
      ["3", "skill3", "tap", "Golpe em Área"], ["4", "skill4", "tap", "Aura"],
      ["5", "potion1", "tap", "Poção 1"], ["6", "potion2", "tap", "Poção 2"],
    ],
    main: [
      ["ATQ", "attack", "tap", "Ataque básico", "big"], ["E", "interact", "tap", "Falar / usar / corda", "mid"],
      ["OK", "ENTER", "tap", "Confirmar"],
    ],
    util: [
      ["Esc", "ESC", "tap", "Pausa / voltar"], ["Mochila", "bag", "tap", "Mochila"],
      ["Mapa", "map", "tap", "Mapa"], ["Auto", "autoAttack", "tap", "Ataque automático"],
    ],
  };

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
    const css = `
      #vt { position: fixed; inset: 0; pointer-events: none; z-index: 50; font-family: "Pixelify", monospace; user-select: none; -webkit-user-select: none; }
      #vt .vt-layer { position: absolute; inset: 0; pointer-events: none; }
      #vt .vt-btn { pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent;
        background: rgba(20,16,26,.62); color: #e8e1d3; border: 1px solid rgba(201,162,74,.75); border-radius: 10px;
        font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center;
        width: 58px; height: 58px; box-shadow: 0 2px 0 rgba(0,0,0,.5); padding: 0; }
      #vt .vt-btn.on { background: rgba(139,30,45,.85); transform: translateY(1px); }
      #vt .vt-small { width: 44px; height: 44px; font-size: 15px; }
      #vt .vt-util { width: auto; min-width: 52px; height: 36px; font-size: 13px; padding: 0 8px; }
      #vt .vt-big { width: 84px; height: 84px; font-size: 20px; border-color: #c9a24a; }
      #vt .vt-mid { width: 66px; height: 66px; }
      #vt .pad { position: absolute; left: 14px; bottom: 14px; display: grid; grid-template-columns: repeat(3, 58px); grid-template-rows: repeat(3, 58px); gap: 6px; }
      #vt .main { position: absolute; right: 14px; bottom: 14px; display: flex; gap: 12px; align-items: flex-end; }
      #vt .skills { position: absolute; right: 14px; bottom: 108px; display: grid; grid-template-columns: repeat(3, 44px); gap: 6px; }
      #vt .util { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; align-items: center; }
      #vt .toggle { position: absolute; top: 10px; left: 10px; pointer-events: auto; }
      #vt.hidden .vt-layer { display: none; }
      #vt .toggle-wrap { position: absolute; inset: 0; pointer-events: none; }
      @media (max-width: 520px) {
        #vt .vt-btn { width: 50px; height: 50px; }
        #vt .pad { grid-template-columns: repeat(3, 50px); grid-template-rows: repeat(3, 50px); }
        #vt .vt-big { width: 74px; height: 74px; }
        #vt .vt-mid { width: 58px; height: 58px; }
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

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
    toggle.title = "Mostrar/ocultar controles"; toggle.setAttribute("aria-label", "Mostrar ou ocultar controles de toque");
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
})();
