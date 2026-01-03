// ===== Storage helpers =====
const LS = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const KEYS = {
  auth: "gen_auth",
  users: "gen_users",
  trees: "gen_trees",
  persons: "gen_persons"
};

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

// ===== Auth (mock) =====
function getAuth(){ return LS.get(KEYS.auth, null); }
function isAuthed(){ return !!getAuth(); }
function requireAuth(){
  if(!isAuthed()){
    window.location.href = "login.html";
  }
}
function logout(){
  localStorage.removeItem(KEYS.auth);
  window.location.href = "index.html";
}

function registerMock({email, password, displayName}){
  const users = LS.get(KEYS.users, []);
  if(users.some(u => u.email.toLowerCase() === email.toLowerCase())){
    throw new Error("Konto o tym emailu już istnieje.");
  }
  const user = { id: uid("usr"), email, password, displayName };
  users.push(user);
  LS.set(KEYS.users, users);
  // Auto-login
  LS.set(KEYS.auth, { userId: user.id, email: user.email, displayName: user.displayName });
  seedIfEmpty(user.id);
}

function loginMock({email, password}){
  const users = LS.get(KEYS.users, []);
  const u = users.find(x => x.email.toLowerCase() === email.toLowerCase());
  if(!u || u.password !== password){
    throw new Error("Nieprawidłowy email lub hasło.");
  }
  LS.set(KEYS.auth, { userId: u.id, email: u.email, displayName: u.displayName });
  seedIfEmpty(u.id);
}

// ===== Data model (mock) =====
// trees: { id, ownerId, name, createdAt }
// persons: { id, ownerId, treeId, firstName, lastName, sex, birthDate, deathDate, note, fatherId, motherId, partnerId }

function getTrees(ownerId){
  return LS.get(KEYS.trees, []).filter(t => t.ownerId === ownerId);
}
function addTree(ownerId, name){
  const trees = LS.get(KEYS.trees, []);
  const tree = { id: uid("tre"), ownerId, name: name.trim(), createdAt: new Date().toISOString() };
  trees.push(tree);
  LS.set(KEYS.trees, trees);
  return tree;
}
function getPersons(ownerId, treeId){
  return LS.get(KEYS.persons, []).filter(p => p.ownerId === ownerId && p.treeId === treeId);
}
function getPersonById(id){
  return LS.get(KEYS.persons, []).find(p => p.id === id) ?? null;
}
function upsertPerson(person){
  const persons = LS.get(KEYS.persons, []);
  const idx = persons.findIndex(p => p.id === person.id);
  if(idx >= 0) persons[idx] = person;
  else persons.push(person);
  LS.set(KEYS.persons, persons);
}
function deletePerson(personId){
  const persons = LS.get(KEYS.persons, []);
  const updated = persons.filter(p => p.id !== personId);
  // Also remove references
  for(const p of updated){
    if(p.fatherId === personId) p.fatherId = "";
    if(p.motherId === personId) p.motherId = "";
    if(p.partnerId === personId) p.partnerId = "";
  }
  LS.set(KEYS.persons, updated);
}

// ===== Seed demo (only if empty for this user) =====
function seedIfEmpty(ownerId){
  const existingTrees = getTrees(ownerId);
  if(existingTrees.length > 0) return;

  const tree = addTree(ownerId, "Moje drzewo (demo)");
  const a = { id: uid("per"), ownerId, treeId: tree.id, firstName:"Jan", lastName:"Kowalski", sex:"M", birthDate:"1970-04-12", deathDate:"", note:"", fatherId:"", motherId:"", partnerId:"" };
  const b = { id: uid("per"), ownerId, treeId: tree.id, firstName:"Anna", lastName:"Kowalska", sex:"F", birthDate:"1972-09-03", deathDate:"", note:"", fatherId:"", motherId:"", partnerId:"" };
  a.partnerId = b.id; b.partnerId = a.id;

  const c = { id: uid("per"), ownerId, treeId: tree.id, firstName:"Piotr", lastName:"Kowalski", sex:"M", birthDate:"1999-01-15", deathDate:"", note:"Syn Jana i Anny", fatherId:a.id, motherId:b.id, partnerId:"" };

  upsertPerson(a); upsertPerson(b); upsertPerson(c);
}

// ===== UI helpers =====
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function setNavAuthState(){
  const auth = getAuth();
  const elUser = qs("[data-auth-user]");
  const elLogin = qs("[data-auth-login]");
  const elLogout = qs("[data-auth-logout]");
  const elDashboard = qs("[data-auth-dashboard]");

  if(elUser) elUser.textContent = auth ? auth.displayName : "";
  if(elLogin) elLogin.classList.toggle("d-none", !!auth);
  if(elLogout) elLogout.classList.toggle("d-none", !auth);
  if(elDashboard) elDashboard.classList.toggle("d-none", !auth);
}

function toast(msg, type="info"){
  const container = qs(".toast-container");
  if(!container){ alert(msg); return; }

  const id = uid("toast");
  const html = `
  <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
    <div class="d-flex">
      <div class="toast-body">${msg}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  </div>`;
  container.insertAdjacentHTML("beforeend", html);
  const t = new bootstrap.Toast(qs(`#${id}`), { delay: 3500 });
  t.show();
  qs(`#${id}`).addEventListener("hidden.bs.toast", () => qs(`#${id}`)?.remove());
}

// ===== Page wiring =====
document.addEventListener("DOMContentLoaded", () => {
  setNavAuthState();

  // Logout page
  if(document.body.dataset.page === "logout"){
    logout();
    return;
  }

  // Index
  if(document.body.dataset.page === "index"){
    const btn = qs("#go-dashboard");
    if(btn){
      btn.addEventListener("click", () => {
        if(isAuthed()) window.location.href = "dashboard.html";
        else window.location.href = "login.html";
      });
    }
  }

  // Register
  if(document.body.dataset.page === "register"){
    const form = qs("#register-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const displayName = qs("#displayName").value.trim();
      const email = qs("#email").value.trim();
      const password = qs("#password").value;
      try{
        registerMock({email, password, displayName});
        window.location.href = "dashboard.html";
      }catch(err){
        toast(err.message, "danger");
      }
    });
  }

  // Login
  if(document.body.dataset.page === "login"){
    const form = qs("#login-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = qs("#email").value.trim();
      const password = qs("#password").value;
      try{
        loginMock({email, password});
        window.location.href = "dashboard.html";
      }catch(err){
        toast(err.message, "danger");
      }
    });
  }

  // Dashboard
  if(document.body.dataset.page === "dashboard"){
    requireAuth();
    const auth = getAuth();
    const list = qs("#tree-list");
    const empty = qs("#tree-empty");
    const form = qs("#create-tree-form");

    function render(){
      const trees = getTrees(auth.userId);
      if(trees.length === 0){
        empty.classList.remove("d-none");
        list.innerHTML = "";
        return;
      }
      empty.classList.add("d-none");
      list.innerHTML = trees.map(t => `
        <div class="col-md-6">
          <div class="card p-3 h-100">
            <div class="d-flex align-items-start justify-content-between">
              <div>
                <div class="badge badge-soft mb-2">Drzewo</div>
                <h5 class="mb-1">${escapeHtml(t.name)}</h5>
                <div class="small-muted">Utworzone: ${new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <a class="btn btn-sm btn-accent" href="tree.html?treeId=${encodeURIComponent(t.id)}">Otwórz</a>
            </div>
          </div>
        </div>
      `).join("");
      updateKpis();
    }

    function updateKpis(){
      const trees = getTrees(auth.userId);
      const persons = LS.get(KEYS.persons, []).filter(p => p.ownerId === auth.userId);
      qs("#kpi-trees").textContent = trees.length;
      qs("#kpi-persons").textContent = persons.length;
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = qs("#treeName").value.trim();
      if(name.length < 3){
        toast("Nazwa drzewa powinna mieć min. 3 znaki.", "warning");
        return;
      }
      addTree(auth.userId, name);
      qs("#treeName").value = "";
      toast("Utworzono nowe drzewo.", "success");
      render();
    });

    render();
  }

  // Tree view
  if(document.body.dataset.page === "tree"){
    requireAuth();
    const auth = getAuth();
    const params = new URLSearchParams(window.location.search);
    const treeId = params.get("treeId") || "";

    const trees = getTrees(auth.userId);
    const tree = trees.find(t => t.id === treeId) || trees[0] || null;

    if(!tree){
      window.location.href = "dashboard.html";
      return;
    }

    qs("#tree-title").textContent = tree.name;
    qs("#add-person-btn").setAttribute("href", `person-form.html?treeId=${encodeURIComponent(tree.id)}`);

    function render(){
      const persons = getPersons(auth.userId, tree.id);
      qs("#person-count").textContent = persons.length;

      const tbody = qs("#persons-tbody");
      tbody.innerHTML = persons.map(p => {
        const father = p.fatherId ? getPersonById(p.fatherId) : null;
        const mother = p.motherId ? getPersonById(p.motherId) : null;
        const partner = p.partnerId ? getPersonById(p.partnerId) : null;
        return `
          <tr>
            <td>
              <div class="fw-semibold">${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</div>
              <div class="small-muted">${p.sex === "M" ? "Mężczyzna" : p.sex === "F" ? "Kobieta" : "—"}</div>
            </td>
            <td class="small-muted">${fmtDate(p.birthDate)} – ${fmtDate(p.deathDate)}</td>
            <td class="small-muted">
              ${father ? `${escapeHtml(father.firstName)} ${escapeHtml(father.lastName)}` : "—"} /
              ${mother ? `${escapeHtml(mother.firstName)} ${escapeHtml(mother.lastName)}` : "—"}
            </td>
            <td class="small-muted">${partner ? `${escapeHtml(partner.firstName)} ${escapeHtml(partner.lastName)}` : "—"}</td>
            <td class="text-end">
              <a class="btn btn-sm btn-outline-dark" href="person-form.html?treeId=${encodeURIComponent(tree.id)}&personId=${encodeURIComponent(p.id)}">Edytuj</a>
              <button class="btn btn-sm btn-outline-danger ms-1" data-del="${p.id}">Usuń</button>
            </td>
          </tr>
        `;
      }).join("");

      qsa("[data-del]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-del");
          if(confirm("Usunąć osobę? Relacje zostaną wyczyszczone.")){
            deletePerson(id);
            toast("Usunięto osobę.", "success");
            render();
          }
        });
      });
    }

    render();
  }

  // Person form
  if(document.body.dataset.page === "person-form"){
    requireAuth();
    const auth = getAuth();
    const params = new URLSearchParams(window.location.search);
    const treeId = params.get("treeId") || "";
    const personId = params.get("personId") || "";

    const trees = getTrees(auth.userId);
    const tree = trees.find(t => t.id === treeId) || trees[0] || null;
    if(!tree){
      window.location.href = "dashboard.html";
      return;
    }

    const persons = getPersons(auth.userId, tree.id);
    const existing = personId ? persons.find(p => p.id === personId) : null;

    qs("#form-title").textContent = existing ? "Edytuj osobę" : "Dodaj osobę";
    qs("#back-to-tree").setAttribute("href", `tree.html?treeId=${encodeURIComponent(tree.id)}`);

    // Populate selects (father/mother/partner)
    const options = [`<option value="">—</option>`]
      .concat(persons.filter(p => !existing || p.id !== existing.id).map(p =>
        `<option value="${p.id}">${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)} (${p.sex || "—"})</option>`
      )).join("");

    qs("#fatherId").innerHTML = options;
    qs("#motherId").innerHTML = options;
    qs("#partnerId").innerHTML = options;

    if(existing){
      qs("#firstName").value = existing.firstName || "";
      qs("#lastName").value = existing.lastName || "";
      qs("#sex").value = existing.sex || "";
      qs("#birthDate").value = existing.birthDate || "";
      qs("#deathDate").value = existing.deathDate || "";
      qs("#note").value = existing.note || "";
      qs("#fatherId").value = existing.fatherId || "";
      qs("#motherId").value = existing.motherId || "";
      qs("#partnerId").value = existing.partnerId || "";
    }

    qs("#person-form").addEventListener("submit", (e) => {
      e.preventDefault();

      const firstName = qs("#firstName").value.trim();
      const lastName = qs("#lastName").value.trim();
      const sex = qs("#sex").value;
      const birthDate = qs("#birthDate").value;
      const deathDate = qs("#deathDate").value;
      const note = qs("#note").value.trim();
      const fatherId = qs("#fatherId").value;
      const motherId = qs("#motherId").value;
      const partnerId = qs("#partnerId").value;

      if(firstName.length < 2 || lastName.length < 2){
        toast("Imię i nazwisko powinny mieć min. 2 znaki.", "warning");
        return;
      }
      if(birthDate && deathDate && birthDate > deathDate){
        toast("Data urodzenia nie może być po dacie śmierci.", "warning");
        return;
      }
      if(existing && (fatherId === existing.id || motherId === existing.id || partnerId === existing.id)){
        toast("Nie można ustawić osoby jako własnego rodzica/partnera.", "danger");
        return;
      }

      const p = existing ? {...existing} : {
        id: uid("per"),
        ownerId: auth.userId,
        treeId: tree.id,
        fatherId: "",
        motherId: "",
        partnerId: ""
      };

      p.firstName = firstName;
      p.lastName = lastName;
      p.sex = sex;
      p.birthDate = birthDate;
      p.deathDate = deathDate;
      p.note = note;
      p.fatherId = fatherId;
      p.motherId = motherId;
      p.partnerId = partnerId;

      upsertPerson(p);

      // Keep partner symmetry if chosen
      if(partnerId){
        const partner = getPersonById(partnerId);
        if(partner){
          partner.partnerId = p.id;
          upsertPerson(partner);
        }
      }

      toast(existing ? "Zapisano zmiany." : "Dodano osobę.", "success");
      window.location.href = `tree.html?treeId=${encodeURIComponent(tree.id)}`;
    });
  }
});

// ===== utils =====
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function fmtDate(d){
  if(!d) return "—";
  try{
    return new Date(d).toLocaleDateString();
  }catch{
    return d;
  }
}
