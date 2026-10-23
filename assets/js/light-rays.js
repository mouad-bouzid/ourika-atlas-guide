/* Light Rays — vanilla WebGL port of the React Bits component (no React / OGL needed).
   window.LightRays.init(container, options) -> { destroy() } | null            */
(() => {
  "use strict";

  const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform float noiseAmount;
uniform float distortion;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 refDir, vec2 coord, float seedA, float seedB, float speed) {
  vec2 toCoord = coord - raySource;
  vec2 dirNorm = normalize(toCoord);
  float cosAngle = dot(dirNorm, refDir);
  float dAngle = cosAngle + distortion * sin(iTime * 2.0 + length(toCoord) * 0.01) * 0.2;
  float spread = pow(max(dAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float dist = length(toCoord);
  float maxDist = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDist - dist) / maxDist, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x * fadeDistance - dist) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
  float base = clamp(
    (0.45 + 0.15 * sin(dAngle * seedA + iTime * speed)) +
    (0.30 + 0.20 * cos(-dAngle * seedB + iTime * speed)),
    0.0, 1.0);
  return base * lengthFalloff * fadeFalloff * spread * pulse;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  float r1 = rayStrength(rayPos, rayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  float r2 = rayStrength(rayPos, rayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  float s = r1 * 0.5 + r2 * 0.4;

  float n = noise(coord * 0.01 + iTime * 0.1);
  s *= (1.0 - noiseAmount + noiseAmount * n);

  float brightness = 1.0 - (coord.y / iResolution.y);
  s *= 0.1 + brightness * 0.8;

  vec3 col = vec3(s);
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, saturation) * raysColor;
  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  };

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[LightRays] shader error:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function init(container, options = {}) {
    const o = Object.assign({
      color: "#ffffff",
      raysSpeed: 0.5,
      lightSpread: 0.9,
      rayLength: 1.6,
      pulsating: false,
      fadeDistance: 1.0,
      saturation: 1.0,
      noiseAmount: 0.08,
      distortion: 0.1,
      originX: 0.5,        // 0..1 across the width
      originY: -0.2,       // relative to height (negative = above the top edge)
      scale: 0.6,          // render resolution factor (soft rays don't need full res)
      static: false        // draw a single frame (reduced motion)
    }, options);

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) return null;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const u = {
      iTime: U("iTime"), iResolution: U("iResolution"), rayPos: U("rayPos"), rayDir: U("rayDir"),
      raysColor: U("raysColor"), raysSpeed: U("raysSpeed"), lightSpread: U("lightSpread"),
      rayLength: U("rayLength"), pulsating: U("pulsating"), fadeDistance: U("fadeDistance"),
      saturation: U("saturation"), noiseAmount: U("noiseAmount"), distortion: U("distortion")
    };

    container.appendChild(canvas);

    let w = 1, h = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(2, Math.round(container.clientWidth * o.scale * dpr));
      h = Math.max(2, Math.round(container.clientHeight * o.scale * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      if (o.static) draw(4);
    };

    const rgb = hexToRgb(o.color);
    function draw(t) {
      gl.uniform1f(u.iTime, t);
      gl.uniform2f(u.iResolution, w, h);
      gl.uniform2f(u.rayPos, o.originX * w, o.originY * h);
      gl.uniform2f(u.rayDir, 0, 1);
      gl.uniform3f(u.raysColor, rgb[0], rgb[1], rgb[2]);
      gl.uniform1f(u.raysSpeed, o.raysSpeed);
      gl.uniform1f(u.lightSpread, o.lightSpread);
      gl.uniform1f(u.rayLength, o.rayLength);
      gl.uniform1f(u.pulsating, o.pulsating ? 1 : 0);
      gl.uniform1f(u.fadeDistance, o.fadeDistance);
      gl.uniform1f(u.saturation, o.saturation);
      gl.uniform1f(u.noiseAmount, o.noiseAmount);
      gl.uniform1f(u.distortion, o.distortion);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    let raf = 0, visible = true, start = performance.now(), ready = false;
    const frame = (now) => {
      raf = 0;
      draw((now - start) / 1000);
      if (!ready) { ready = true; container.classList.add("is-ready"); }
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !o.static) raf = requestAnimationFrame(frame); };

    resize();
    if (o.static) {
      container.classList.add("is-ready");
    } else {
      kick();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    // pause when the hero is off-screen or the tab is hidden
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
    io.observe(container);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);

    return {
      destroy() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        canvas.remove();
      }
    };
  }

  window.LightRays = { init };
})();
