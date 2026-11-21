"use strict";
(() => {
  const topics = window.THEME_LIBRARY;
  const home = document.getElementById("home");
  const cards = document.getElementById("theme-cards");
  const pages = document.getElementById("topic-pages");
  const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[char]);
  if (!Array.isArray(topics) || !topics.length) {
    cards.textContent = "主题资料暂时未能加载，请刷新页面。";
    return;
  }
  const prompt = (id, title, text, label) => `
    <div class="prompt-box">
      <div class="prompt-actions"><span>${escape(title)}</span><button type="button" data-copy="${id}">${escape(label)}</button></div>
      <details class="prompt-details"><summary>查看提示词全文</summary><pre id="${id}">${escape(text)}</pre></details>
      <p class="copy-status" role="status" aria-live="polite"></p>
    </div>`;
  const step = (topic, index, title, action, result, extra = "") => `
    <li class="step block" id="${topic.id}-step-${index}" tabindex="-1">
      <div class="step-head"><span class="step-number" aria-hidden="true">${String(index).padStart(2, "0")}</span><h2>${title}</h2></div>
      <p class="action">${escape(action)}</p>
      ${index === 1 ? extra : ""}
      <p class="expected"><span>这一步得到</span>${escape(result)}</p>
      ${index === 1 ? "" : extra}
    </li>`;
  const saveHelp = `
    <details class="help"><summary>第一次保存网页？看这 4 个动作</summary>
      <ol class="save-guide">
        <li><strong>复制代码</strong>复制 AI 给出的完整 HTML；不要把代码框外的解释和三个反引号一起复制。</li>
        <li><strong>用记事本保存</strong>粘贴后点“文件 → 另存为”，放到单独的作品文件夹。</li>
        <li><strong>检查文件名</strong>填 <code>index.html</code>，保存类型选“所有文件”，编码选 UTF-8；不要保存成 <code>index.html.txt</code>。</li>
        <li><strong>双击打开</strong>用电脑浏览器打开。修改前另存一份旧版，收到新代码后再保存、刷新。</li>
      </ol>
      <p class="note">以上是 Windows 电脑操作。手机可阅读、复制资料；首次保存和试玩建议由大人在电脑完成。</p>
    </details>`;
  const visualFlow = `
    <div class="flow-guide" aria-label="操作示意：孩子先说想法，AI逐个提问，双方确认需求">
      <span>孩子说想法</span><b aria-hidden="true">→</b><span>AI 逐个问</span><b aria-hidden="true">→</b><span>一起确认</span>
    </div>`;
  document.getElementById("theme-count").textContent = `${topics.length} 个创作主题`;
  cards.innerHTML = topics.map(topic => `
    <a class="card ${escape(topic.accent)}" href="#${escape(topic.id)}">
      <div class="cover cover-${escape(topic.id)}"><img src="${escape(topic.image)}" alt="" loading="lazy" decoding="async">${topic.badge ? `<span class="image-badge">${escape(topic.badge)}</span>` : ""}</div>
      <div class="card-body"><span class="eyebrow">${escape(topic.category)}</span><h3>${escape(topic.title)}</h3><p>${escape(topic.tagline)}</p><span class="card-link">开始创作 <span aria-hidden="true">↗</span></span></div>
    </a>`).join("");
  const labels = ["想点子", "确认需求", "做第一版", "保存试玩", "改一点", "留下作品"];
  pages.innerHTML = topics.map(topic => {
    const id = escape(topic.id);
    const checks = `<div class="check-list"><h3>打开后，先检查这些</h3><ul>${topic.checks.map(text => `<li>${escape(text)}</li>`).join("")}</ul></div>`;
    const ref = `<figure class="reference"><a href="${escape(topic.image)}" target="_blank" rel="noopener" aria-label="在新窗口查看${escape(topic.title)}完整参考图"><img src="${escape(topic.image)}" alt="${escape(topic.title)}创意视觉参考，非运行截图" loading="lazy" decoding="async"><span>查看完整参考图 ↗</span></a><figcaption>${escape(topic.reference)}<br>视觉参考，非运行截图。</figcaption></figure>`;
    const warning = topic.badge ? `<p class="notice"><strong>先说清楚</strong>这是交互演示，未接入真实 AI 图像生成。参考图中的新怪兽图片是效果设想，不是本次网页能生成的成果。</p>` : "";
    const example = `<ol class="first-actions">${topic.firstActions.map(action => `<li>${escape(action)}</li>`).join("")}</ol><div class="example"><h3>比如，可以这样开始</h3><p>${escape(topic.example)}</p><small>这只是例子，你们可以换成自己的想法。</small></div>`;
    return `
      <article class="detail ${escape(topic.accent)}" id="${id}" aria-labelledby="${id}-title" hidden>
        <a class="back" href="#themes">← 返回全部主题</a>
        <header class="detail-head"><span class="eyebrow">${escape(topic.category)}${topic.badge ? " · 交互演示" : ""}</span><h1 id="${id}-title" tabindex="-1">${escape(topic.title)}</h1><p>${escape(topic.intro)}</p>
          <dl class="mission-facts"><div><dt>做完能玩什么</dt><dd>${escape(topic.outcome)}</dd></div><div><dt>先准备这些</dt><dd>${escape(topic.prepare)}</dd></div></dl>
        </header>
        ${warning}
        <nav class="step-nav" aria-label="${escape(topic.title)}步骤导航">${labels.map((label, index) => `<button type="button" data-jump="${id}-step-${index + 1}"><span>${index + 1}</span>${label}</button>`).join("")}</nav>
        <ol class="workflow">
          ${step(topic, 1, topic.id === "monster" ? "画一只自己的怪兽" : topic.id === "inventor" ? "准备三栏发明词" : "写下你们想做的活动", topic.think, topic.thinkResult, example)}
          ${step(topic, 2, "把想法告诉 AI", "打开你选用的 AI 编程工具，新建一个对话。点下方“复制需求引导”，粘贴并发送；AI 问你时，就用第 1 步准备的内容回答。等它整理好清单，一起看有没有漏掉或弄错的地方，没有问题就回复“这份清单没问题”。", "一份你们看过并确认的需求清单。保持这个对话打开，下一步继续在这里发消息。", visualFlow + prompt(`${id}-brief`, "复制后，发给 AI", topic.brief, "复制需求引导"))}
          ${step(topic, 3, "制作第一版", topic.build, "一份完整的 index.html 网页代码。", prompt(`${id}-production`, "需求确认后再发", topic.production, "复制制作提示词") + ref)}
          ${step(topic, 4, "保存打开，一起试玩", topic.id === "monster" ? "复制 AI 给出的完整代码，用记事本另存为 index.html，再双击打开。在你们做出的网页里选择第 1 步准备的涂鸦，填写怪兽昵称，试试改造按钮。不会保存时，展开下面的 4 个动作。" : "复制 AI 给出的完整代码，用记事本另存为 index.html，再双击打开。先按下面的清单检查功能，然后和孩子一起玩。不会保存时，展开下面的 4 个动作。", "一个已经在你们电脑浏览器里打开的作品。遇到问题记下“点了什么、出现什么”，下一步交给 AI 修改。", saveHelp + checks)}
          ${step(topic, 5, "听孩子的，改一点", topic.reviseExample + "把实际看到的问题或想改的地方告诉同一个 AI，不用重新开对话。", "一个保留核心玩法的新版本，以及孩子自己的改造理由。", prompt(`${id}-revise`, "需要修改时使用", topic.revise, "复制修改引导") + `<details class="help"><summary>打不开或结果不对，怎么问？</summary><p>告诉 AI：我在哪一步、点了什么、实际出现什么、我希望怎样。可以附不含个人信息的报错或页面截图；不要直接让 AI 把整个作品重做一遍。</p></details>`)}
          ${step(topic, 6, "留下作品，下次接着玩", "把最终的 index.html 和一张试玩截图放进自己的作品文件夹。如果作品已经有能打开的网址，再到下方点“保存作品链接”，填写名称和网址，下次就能从存档里打开。没有网址也没关系，先保留电脑里的文件。", "一份保存好的作品；有网址时，再多留一个能点击打开的作品链接。", `<p class="note">只用作品名或昵称，不放孩子的身份信息。这里保存链接，不上传 HTML 或图片文件。</p>`)}
        </ol>
        <section class="archive block" aria-labelledby="${id}-archive">
          <div class="archive-heading"><h2 id="${id}-archive">AI 成果存档</h2><button type="button" class="archive-toggle" data-archive-toggle="${id}" aria-expanded="false" aria-controls="${id}-archive-form">＋ 保存作品链接</button></div>
          <p class="archive-description">把做好的作品网址留在这里，下次一点击就能打开。</p>
          <div class="result-links" data-archive-list="${id}"></div>
          <form id="${id}-archive-form" class="archive-form" data-archive-form="${id}" hidden>
            <label>作品名称<input name="title" maxlength="60" required placeholder="例如：我们的周末幸运转盘" autocomplete="off"></label>
            <label>作品网址<input name="url" type="url" maxlength="2048" required placeholder="https://…" autocomplete="off"></label>
            <p class="note">填能直接打开作品的 http 或 https 网址；电脑里的文件路径不能作为网页链接保存。</p>
            <div class="archive-form-actions"><button type="submit">保存链接</button><button type="button" data-archive-cancel="${id}">取消</button></div>
          </form>
          <p class="archive-status" data-archive-status="${id}" role="status" aria-live="polite"></p>
          <p class="archive-storage-note">链接只保存在当前浏览器，不会上传，也不随账号同步；换设备、换网址或清理浏览器数据后不会自动跟随。</p>
        </section>
        <a class="back bottom-back" href="#themes">← 看看其他创作主题</a>
      </article>`;
  }).join("");
  const details = [...document.querySelectorAll(".detail")];
  function route() {
    const id = location.hash.slice(1);
    const active = details.find(page => page.id === id);
    home.hidden = Boolean(active);
    details.forEach(page => { page.hidden = page !== active; });
    document.title = active ? `${active.querySelector("h1").textContent} · 亲子AI创造资料库` : "亲子AI创造资料库";
    if (active) {
      window.scrollTo({top: 0, behavior: "instant"});
      active.querySelector("h1").focus({preventScroll: true});
    } else if (id === "themes") {
      document.getElementById("themes").scrollIntoView();
      document.getElementById("themes").focus({preventScroll: true});
    } else window.scrollTo({top: 0, behavior: "instant"});
  }
  window.addEventListener("hashchange", route);
  route();
  document.querySelectorAll("[data-jump]").forEach(button => button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.jump);
    target.scrollIntoView({block: "start"});
    target.focus({preventScroll: true});
  }));
  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const source = document.getElementById(button.dataset.copy);
      const status = button.closest(".prompt-box").querySelector(".copy-status");
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(source.textContent);
          copied = true;
        }
      } catch {}
      if (!copied) {
        const field = document.createElement("textarea");
        field.value = source.textContent;
        field.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.append(field);
        field.select();
        try { copied = document.execCommand("copy"); } catch {}
        field.remove();
        button.focus();
      }
      if (copied) status.textContent = "已复制。粘贴到同一个 AI 对话即可。";
      else {
        source.closest("details").open = true;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(source);
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = "自动复制未获允许，已选中文本；按 Ctrl+C 或长按复制。";
      }
    });
  });
  // One browser-scoped list per topic. No account data, file uploads, or network requests.
  const archiveKey = "qinzi-ai-lab:creation-links:v1";
  function safeURL(value) {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || value.length > 2048) throw new Error("INVALID_URL");
    return url.href;
  }
  function readArchive() {
    const saved = window.localStorage.getItem(archiveKey);
    if (saved === null) return [];
    const records = JSON.parse(saved);
    if (!Array.isArray(records) || records.some(record => !record || typeof record.title !== "string" || !record.title.trim() || record.title.length > 60 || typeof record.url !== "string" || typeof record.topic !== "string")) throw new Error("INVALID_ARCHIVE");
    records.forEach(record => safeURL(record.url));
    return records;
  }
  function renderArchive(topicId) {
    const list = document.querySelector(`[data-archive-list="${topicId}"]`);
    try {
      const records = [...topics.find(topic => topic.id === topicId).archive, ...readArchive().filter(record => record.topic === topicId)];
      list.innerHTML = records.length ? records.map(record => `<a class="saved-creation" href="${escape(safeURL(record.url))}" target="_blank" rel="noopener noreferrer"><span>${escape(record.title)}</span><span aria-hidden="true">打开作品 ↗</span></a>`).join("") : '<p class="archive-empty">还没有作品链接。完成后，点上方按钮存下你们的第一件作品。</p>';
    } catch {
      list.textContent = "暂时无法读取这个浏览器的存档。已有内容不会被覆盖；请先自行保留作品网址。";
    }
  }
  topics.forEach(topic => renderArchive(topic.id));
  document.querySelectorAll("[data-archive-toggle]").forEach(button => button.addEventListener("click", () => {
    const form = document.getElementById(`${button.dataset.archiveToggle}-archive-form`);
    form.hidden = !form.hidden;
    button.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) form.elements.title.focus();
  }));
  document.querySelectorAll("[data-archive-cancel]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.archiveCancel;
    document.getElementById(`${id}-archive-form`).hidden = true;
    const toggle = document.querySelector(`[data-archive-toggle="${id}"]`);
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }));
  document.querySelectorAll("[data-archive-form]").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault();
    const id = form.dataset.archiveForm;
    const status = document.querySelector(`[data-archive-status="${id}"]`);
    const title = form.elements.title.value.trim();
    if (!title || title.length > 60) { status.textContent = "请给作品起一个 1–60 字的名字。"; return; }
    let url;
    try { url = safeURL(form.elements.url.value.trim()); }
    catch { status.textContent = "请填写完整的 http 或 https 作品网址，不要填写文件路径或带密码的链接。"; return; }
    try {
      const records = readArchive();
      if (records.some(record => record.topic === id && record.url === url)) {
        status.textContent = "这个作品链接已经保存过了，可以从下方打开。";
        return;
      }
      records.push({topic: id, title, url});
      window.localStorage.setItem(archiveKey, JSON.stringify(records));
      renderArchive(id);
      form.reset();
      form.hidden = true;
      const toggle = document.querySelector(`[data-archive-toggle="${id}"]`);
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
      status.textContent = "已保存在这个浏览器。点击作品名称即可在新窗口打开。";
    } catch {
      status.textContent = "保存没有成功。浏览器存储可能不可用，或已有存档无法读取；请先把网址另存到便签，原存档没有被覆盖。";
    }
  }));
})();

(() => {
  const account = document.getElementById("local-account");
  if (!account) return;

  const greeting = document.getElementById("account-greeting");
  const message = document.getElementById("account-message");
  const form = document.getElementById("account-form");
  const register = document.getElementById("account-register");
  const login = document.getElementById("account-login");
  const logout = document.getElementById("account-logout");
  const submit = document.getElementById("account-submit");
  const buttons = [register, login, logout, submit];
  let action = "login";

  const accountServer = (location.protocol === "http:" && location.port === "3000" && ["127.0.0.1", "localhost"].includes(location.hostname)) || location.origin === "https://qinzi-ai-lab.vercel.app";
  if (!accountServer) {
    // Keep the entry visible without pretending a static page has an account server.
    const filePreview = location.protocol === "file:";
    const help = filePreview ? "你现在打开的是网页文件。登录功能仍保留，需要先启动项目里的 node server.js，再打开带登录功能的网站。" : "当前网址可以浏览资料；注册和登录功能尚未部署到线上。";
    register.addEventListener("click", () => { message.textContent = help; });
    login.addEventListener("click", () => { message.textContent = help; });
    document.getElementById("account-service-link").hidden = !filePreview;
    message.textContent = filePreview ? "文件预览模式 · 登录需要启动账号服务。" : "资料浏览模式 · 线上账号尚未开放。";
    account.hidden = false;
    return;
  }

  function showUser(username) {
    greeting.textContent = username ? `欢迎，${username}` : "未登录";
    register.hidden = login.hidden = Boolean(username);
    logout.hidden = !username;
    form.hidden = true;
  }

  async function request(route, credentials) {
    const response = await fetch(`/api/${route}`, route === "me" ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "操作失败，请重试。");
    return result;
  }

  async function run(operation) {
    buttons.forEach(button => { button.disabled = true; });
    message.textContent = "";
    try {
      await operation();
    } catch (error) {
      message.textContent = error instanceof TypeError ? "账号服务暂时不可用。" : error.message;
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function openForm(mode) {
    action = mode;
    message.textContent = "";
    form.elements.password.value = "";
    form.elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
    submit.textContent = mode === "register" ? "创建账号" : "确认登录";
    form.hidden = false;
    form.elements.username.focus();
  }

  register.addEventListener("click", () => openForm("register"));
  login.addEventListener("click", () => openForm("login"));
  logout.addEventListener("click", () => run(async () => {
    await request("logout");
    form.reset();
    showUser(null);
    message.textContent = "已退出。";
  }));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const { username, password } = form.elements;
    run(async () => {
      try {
        const result = await request(action, { username: username.value, password: password.value });
        if (action === "register") {
          openForm("login");
          message.textContent = result.message;
          password.focus();
        } else {
          form.reset();
          showUser(result.username);
        }
      } finally {
        password.value = "";
      }
    });
  });

  account.hidden = false;
  run(async () => showUser((await request("me")).username));
})();
