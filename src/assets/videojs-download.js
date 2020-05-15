/**
 * videojs-vjsdownload
 * @version 1.0.4
 * @copyright 2019 7Ds7
 * @license Apache-2.0
 */
!(function (e) { if (typeof exports === 'object' && typeof module !== 'undefined')module.exports = e(); else if (typeof define === 'function' && define.amd)define([], e); else { let t; t = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this, t.videojsVjsdownload = e(); } }(() => (function e(t, o, n) { function r(l, u) { if (!o[l]) { if (!t[l]) { const f = typeof require === 'function' && require; if (!u && f) return f(l, !0); if (i) return i(l, !0); const a = new Error(`Cannot find module '${l}'`); throw a.code = 'MODULE_NOT_FOUND', a; } const d = o[l] = { exports: {} }; t[l][0].call(d.exports, (e) => { const o = t[l][1][e]; return r(o || e); }, d, d.exports, e, t, o, n); } return o[l].exports; } for (var i = typeof require === 'function' && require, l = 0; l < n.length; l++)r(n[l]); return r; }({
  1: [function (e, t, o) {
    (function (e) {
      function n(e, t) { if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function'); } function r(e, t) {
        if (typeof t !== 'function' && t !== null) throw new TypeError(`Super expression must either be null or a function, not ${typeof t}`); e.prototype = Object.create(t && t.prototype, {
          constructor: {
            value: e, enumerable: !1, writable: !0, configurable: !0,
          },
        }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(e, t) : e.__proto__ = t);
      }Object.defineProperty(o, '__esModule', { value: !0 }); const i = (function () { function e(e, t) { for (let o = 0; o < t.length; o++) { const n = t[o]; n.enumerable = n.enumerable || !1, n.configurable = !0, 'value' in n && (n.writable = !0), Object.defineProperty(e, n.key, n); } } return function (t, o, n) { return o && e(t.prototype, o), n && e(t, n), t; }; }()); const l = function (e, t, o) { for (let n = !0; n;) { let r = e; const i = t; const l = o; n = !1, r === null && (r = Function.prototype); let u = Object.getOwnPropertyDescriptor(r, i); if (void 0 !== u) { if ('value' in u) return u.value; const f = u.get; if (void 0 === f) return; return f.call(l); } let a = Object.getPrototypeOf(r); if (a === null) return; e = a, t = i, o = l, n = !0, u = a = void 0; } }; const u = typeof window !== 'undefined' ? window.videojs : void 0 !== e ? e.videojs : null; const f = (function (e) { return e && e.__esModule ? e : { default: e }; }(u)); const a = {
        beforeElement: 'fullscreenToggle', textControl: 'Download video', name: 'downloadButton', downloadURL: null,
      }; const d = f.default.getComponent('Button'); const c = (function (e) { function t() { n(this, t), l(Object.getPrototypeOf(t.prototype), 'constructor', this).apply(this, arguments); } return r(t, e), i(t, [{ key: 'buildCSSClass', value() { return `vjs-vjsdownload ${  l(Object.getPrototypeOf(t.prototype), 'buildCSSClass', this).call(this)}`; } }, { key: 'handleClick', value() { const e = this.player(); window.open(this.options_.downloadURL || e.currentSrc(), 'Download'), e.trigger('downloadvideo'); } }]), t; }(d)); const s = function (e, t) { const o = e.controlBar.addChild(new c(e, t), {}); o.controlText(t.textControl), e.controlBar.el().insertBefore(o.el(), e.controlBar.getChild(t.beforeElement).el()), e.addClass('vjs-vjsdownload'); }; const p = function (e) { const t = this; this.ready(() => { s(t, f.default.mergeOptions(a, e)); }); }; f.default.registerPlugin('vjsdownload', p), o.default = p, t.exports = o.default;
    }).call(this, typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : {});
  }, {}],
}, {}, [1]))(1)));
