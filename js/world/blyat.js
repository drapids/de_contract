const BOOK = {
  'hi & bye': [
    ['привет', 'privet', 'hi'],
    ['здарова', 'zdarova', 'yo / sup'],
    ['всем привет', 'vsem privet', 'hi all (say it at round start)'],
    ['пока', 'poka', 'bye'],
    ['давай', 'davay', 'come on / later / ok bye (does everything)'],
    ['спасибо', 'spasibo', 'thanks'],
    ['пожалуйста', 'pozhaluysta', 'please / you\'re welcome']
  ],
  'in game': [
    ['раш б', 'rash b', 'rush b'],
    ['идём на а', 'idyom na a', 'we go a'],
    ['бомба на а', 'bomba na a', 'bomb is on a'],
    ['один остался', 'odin ostalsya', 'one left'],
    ['он лоу', 'on lou', 'he\'s low (hp)'],
    ['сзади', 'szadi', 'behind (you)'],
    ['дай ак', 'day ak', 'give me an ak'],
    ['эко раунд', 'eko raund', 'eco round'],
    ['фулл бай', 'full bay', 'full buy'],
    ['флешку кидаю', 'fleshku kidayu', 'throwing a flash'],
    ['сейвись', 'seyvis\'', 'save your gun'],
    ['дефай', 'defay', 'defuse it'],
    ['не пикай', 'ne pikay', 'don\'t peek'],
    ['слушай', 'slushay', 'listen'],
    ['гг', 'ge ge', 'gg']
  ],
  'reactions': [
    ['изи', 'izi', 'easy'],
    ['красава', 'krasava', 'nice one / beauty'],
    ['ну ты даёшь', 'nu ty dayosh', 'damn you\'re something'],
    ['я в шоке', 'ya v shoke', 'i\'m in shock'],
    ['да ладно', 'da ladno', 'no way'],
    ['ну такое', 'nu takoe', 'meh'],
    ['ахахах', 'akhakhakh', 'hahaha'],
    ['кринж', 'krinzh', 'cringe']
  ],
  'swears (careful)': [
    ['блять', 'blyat\'', 'f***, damn (the classic)'],
    ['сука', 'suka', 'b**** (used for everything)'],
    ['сука блять', 'suka blyat\'', 'the combo'],
    ['ёб твою мать', 'yob tvoyu mat\'', 'the big one. don\'t say it to grandma'],
    ['иди нахуй', 'idi nakhuy', 'go f*** yourself'],
    ['пиздец', 'pizdets', 'it\'s over / total disaster'],
    ['охуеть', 'okhuyet\'', 'holy s***'],
    ['хуйня', 'khuynya', 'bulls*** / trash'],
    ['заебись', 'zayebis\'', 'f***ing great'],
    ['ебать', 'yebat\'', 'whoa / damn'],
    ['чёрт', 'chyort', 'damn (soft)'],
    ['ёлки палки', 'yolki palki', 'darn it (grandma approved)']
  ],
  'trading': [
    ['сколько', 'skol\'ko', 'how much'],
    ['дорого', 'dorogo', 'expensive'],
    ['дёшево', 'dyoshevo', 'cheap'],
    ['скинь трейд', 'skin\' treyd', 'send a trade'],
    ['обмен', 'obmen', 'trade/swap'],
    ['это скам', 'eto skam', 'this is a scam'],
    ['нож', 'nozh', 'knife'],
    ['перчатки', 'perchatki', 'gloves'],
    ['кейс', 'keys', 'case']
  ],
  'everyday': [
    ['братан', 'bratan', 'bro'],
    ['всё норм', 'vsyo norm', 'all good'],
    ['кушать хочу', 'kushat\' khochu', 'i\'m hungry'],
    ['мама зовёт', 'mama zovyot', 'mom\'s calling'],
    ['завтра в школу', 'zavtra v shkolu', 'school tomorrow'],
    ['я спать', 'ya spat\'', 'i\'m going to sleep'],
    ['чё', 'chyo', 'what (lazy)'],
    ['ну', 'nu', 'well / so / come on']
  ]
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Blyat {
  constructor(w) {
    this.w = w;
    const el = this.el = document.createElement('div');
    el.className = 'blyat';
    el.hidden = true;
    const cats = Object.keys(BOOK);
    el.innerHTML = `<div class="by-book"><div class="by-cover"><b>БЛЯТЛИНГО</b><span>russian for cs</span><button class="by-x">x</button></div>
      <div class="by-tabs">${cats.map((c, i) => `<button data-c="${i}"${i ? '' : ' class="on"'}>${c}</button>`).join('')}</div>
      <div class="by-tr"><input placeholder="translate... (english or russian)"><span class="by-out"></span></div>
      <div class="by-list"></div></div>`;
    w.ui.append(el);
    this.$ = s => el.querySelector(s);
    this.$('.by-x').onclick = () => this.close();
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); this.show(cats[+b.dataset.c]); });
    const inp = this.$('.by-tr input');
    inp.oninput = () => this.translate(inp.value);
    addEventListener('keydown', e => {
      if (e.target.closest?.('input, textarea, select')) { if (e.key === 'Escape' && this.on) this.close(); return; }
      if (e.key === 'Escape' && this.on) this.close();
      if (e.key.toLowerCase() === 'b' && w.active && !w.busy) this.open();
    });
    this.show(cats[0]);
  }

  open() { this.on = true; this.w.busy = true; this.el.hidden = false; this.w.av.play('Idle_TalkingPhone_Loop'); this.w.reading = true; }
  close() { this.on = false; this.w.busy = false; this.el.hidden = true; this.w.reading = false; this.w.av.play('Idle_Loop'); }

  show(cat) {
    const l = this.$('.by-list');
    l.innerHTML = BOOK[cat].map(([ru, tr, en], i) => `<div class="by-row"><div><b>${esc(ru)}</b><i>${esc(tr)}</i><span>${esc(en)}</span></div><button data-say="${esc(ru)}" title="hear it">🔊</button></div>`).join('');
    l.querySelectorAll('[data-say]').forEach(b => b.onclick = () => this.say(b.dataset.say));
  }

  say(t) {
    this.w.say(t, 1800);
    try {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ru-RU';
      const v = speechSynthesis.getVoices().find(v => v.lang?.startsWith('ru'));
      if (v) u.voice = v;
      u.rate = 0.95; u.pitch = 0.8;
      u.volume = Math.min(1, (this.w.opts.volume?.() ?? 0.5) * 1.6);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }

  translate(q) {
    q = q.trim().toLowerCase();
    const out = this.$('.by-out');
    if (!q) { out.textContent = ''; return; }
    let best = null, bs = 0;
    for (const rows of Object.values(BOOK)) for (const r of rows) {
      for (const [k, f] of [[r[0], 2], [r[1], 1], [r[2], 1]]) {
        const s = k.toLowerCase();
        const score = s === q ? 10 : s.startsWith(q) ? 6 : s.includes(q) ? 4 : q.includes(s) && s.length > 2 ? 3 : 0;
        if (score * f > bs) { bs = score * f; best = r; }
      }
    }
    out.innerHTML = best ? `<b>${esc(best[0])}</b> · ${esc(best[1])} · ${esc(best[2])} <button>🔊</button>` : 'not in the book';
    out.querySelector('button')?.addEventListener('click', () => this.say(best[0]));
  }
}
