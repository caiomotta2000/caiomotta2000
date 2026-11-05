/* Lili, a coruja mentora financeira (SVG inline, sem dependências).
 * liliSVG({ size, mood: 'happy'|'wow'|'wink', coin: true }) */
(function (g) {
  'use strict';
  function liliSVG(opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const mood = opts.mood || 'happy';
    const coin = opts.coin !== false;
    const beak = mood === 'wow'
      ? '<ellipse cx="100" cy="122" rx="9" ry="11" fill="#e65100"/><ellipse cx="100" cy="125" rx="5" ry="6" fill="#bf360c"/>'
      : '<path d="M88 112 Q100 106 112 112 L100 130 Z" fill="#ff9800" stroke="#e65100" stroke-width="2" stroke-linejoin="round"/>';
    const rightEye = mood === 'wink'
      ? '<path d="M116 96 Q130 86 144 96" stroke="#311b92" stroke-width="5" fill="none" stroke-linecap="round"/>'
      : '<g class="lili-eye"><circle cx="130" cy="95" r="15" fill="#311b92"/><circle cx="135" cy="89" r="5" fill="#fff"/><circle cx="126" cy="100" r="2.5" fill="#fff"/></g>';
    return `
<svg class="lili lili-${mood}" width="${size}" height="${size * 1.1}" viewBox="0 0 200 220" role="img" aria-label="Lili">
  <g class="lili-body">
    <!-- pés -->
    <g fill="#ff9800" stroke="#e65100" stroke-width="2">
      <path d="M72 200 q-4 12 -12 14 h28 q-6 -3 -6 -14z"/>
      <path d="M128 200 q4 12 12 14 h-28 q6 -3 6 -14z"/>
    </g>
    <!-- tufos -->
    <path d="M48 64 Q36 40 40 20 Q62 34 80 48 Z" fill="#5e35b1"/>
    <path d="M152 64 Q164 40 160 20 Q138 34 120 48 Z" fill="#5e35b1"/>
    <!-- asa esquerda (atrás) -->
    <ellipse class="lili-wing-l" cx="38" cy="138" rx="22" ry="48" fill="#5e35b1" transform="rotate(14 38 138)"/>
    <!-- corpo -->
    <ellipse cx="100" cy="128" rx="72" ry="82" fill="#7e57c2"/>
    <!-- barriga -->
    <ellipse cx="100" cy="158" rx="46" ry="48" fill="#ede7f6"/>
    <g fill="none" stroke="#b39ddb" stroke-width="3" stroke-linecap="round">
      <path d="M78 146 q6 6 12 0 q6 6 12 0 q6 6 12 0"/>
      <path d="M72 164 q6 6 12 0 q6 6 12 0 q6 6 12 0 q6 6 12 0"/>
      <path d="M80 182 q6 6 12 0 q6 6 12 0 q6 6 12 0"/>
    </g>
    <!-- disco facial -->
    <path d="M100 70 C80 52 34 58 36 98 C38 130 76 136 100 120 C124 136 162 130 164 98 C166 58 120 52 100 70Z" fill="#d1c4e9"/>
    <!-- olhos -->
    <circle cx="70" cy="95" r="25" fill="#fff"/>
    <circle cx="130" cy="95" r="25" fill="#fff"/>
    <g class="lili-eye"><circle cx="70" cy="95" r="15" fill="#311b92"/><circle cx="75" cy="89" r="5" fill="#fff"/><circle cx="66" cy="100" r="2.5" fill="#fff"/></g>
    ${rightEye}
    <!-- óculos -->
    <g fill="none" stroke="#ffb300" stroke-width="4">
      <circle cx="70" cy="95" r="28"/><circle cx="130" cy="95" r="28"/><path d="M98 92 q2 -4 4 0"/>
    </g>
    <!-- bochechas -->
    <ellipse cx="48" cy="122" rx="9" ry="5" fill="#f48fb1" opacity=".8"/>
    <ellipse cx="152" cy="122" rx="9" ry="5" fill="#f48fb1" opacity=".8"/>
    ${beak}
    <!-- laço -->
    <path d="M100 136 l-16 -9 v18z M100 136 l16 -9 v18z" fill="#ec407a"/><circle cx="100" cy="136" r="5" fill="#ad1457"/>
    <!-- asa direita segurando moeda -->
    <g class="lili-wing-r">
      ${coin ? '<g class="lili-coin"><circle cx="178" cy="100" r="16" fill="#ffd54f" stroke="#e65100" stroke-width="3"/><text x="178" y="107" text-anchor="middle" font-size="19" font-weight="900" fill="#e65100" font-family="Arial, sans-serif">$</text></g>' : ''}
      <ellipse cx="172" cy="140" rx="18" ry="42" fill="#5e35b1" transform="rotate(-24 172 140)"/>
    </g>
  </g>
</svg>`;
  }
  g.liliSVG = liliSVG;
})(typeof window !== 'undefined' ? window : globalThis);
