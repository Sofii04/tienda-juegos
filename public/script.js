// =====================================
// CONFIGURACIÓN API
// =====================================
const API_BASE = "https://www.cheapshark.com/api/1.0";

// Endpoints base
const DEALS_URL = `${API_BASE}/deals`;
const SEARCH_URL = `${API_BASE}/games?title=`;
const DEAL_DETAIL_URL = `${API_BASE}/deals?id=`;

// =====================================
// REFERENCIAS DEL DOM
// =====================================
const gamesGrid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sortSelect = document.getElementById("sortSelect");
const storeFilter = document.getElementById("storeFilter");
const verMasBtn = document.getElementById("verMas");

// ===============================
// FILTRO POR TIENDA
// ===============================
storeFilter.addEventListener("change", () => {
  const storeId = storeFilter.value;

  if (storeId === "") {
      // Todas las tiendas
      pagina = 0;
      loadDeals();
      return;
  }

  pagina = 0;
  loadDealsFiltered(storeId);
});


// Spinner y mensajes
const spinner = document.getElementById("spinner");
const loadingText = document.getElementById("loadingText");
const errorText = document.getElementById("errorText");
const emptyMessage = document.getElementById("emptyMessage");

// Modal
const detailModal = document.getElementById("detailModal");
const closeModal = document.getElementById("closeModal");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalNormalPrice = document.getElementById("modalNormalPrice");
const modalLink = document.getElementById("modalLink");

// Estado
let pagina = 0;
let modoBusqueda = false;
let textoBuscado = "";

// =====================================
// MANEJO DE ESTADOS (loading, error, empty)
// =====================================
function setLoading(isLoading) {
  if (isLoading) {
    spinner.classList.remove("hidden");
    loadingText.classList.remove("hidden");
    errorText.classList.add("hidden");
    emptyMessage.classList.add("hidden");
  } else {
    spinner.classList.add("hidden");
    loadingText.classList.add("hidden");
  }
}

function showError(message) {
  errorText.textContent = message;
  errorText.classList.remove("hidden");
}

function showEmpty(message = "No se encontraron resultados.") {
  emptyMessage.textContent = message;
  emptyMessage.classList.remove("hidden");
}

// =====================================
// RENDER DE TARJETAS
// =====================================
function renderGames(list) {
  list.forEach(game => {
    const card = document.createElement("div");
    card.className =
      "bg-slate-900 p-3 rounded shadow hover:scale-105 transition border border-slate-800";

    const price = game.salePrice || game.cheapest || "0.00";
    const img = game.thumb || game.image;

    card.innerHTML = `
      <img src="${img}" class="rounded mb-2 w-full h-40 object-cover" />

      <h3 class="font-bold mb-1 text-sm">${game.title}</h3>

      <p class="text-cyan-400 font-semibold">$${price}</p>

      <button
        data-id="${game.dealID || game.gameID}"
        class="bg-cyan-500 hover:bg-cyan-600 text-white mt-2 w-full py-1 rounded text-sm"
      >
        Ver detalle
      </button>
    `;

    gamesGrid.appendChild(card);
  });

  activarModalBotones();
}

// =====================================
// BOTONES → MODAL DETALLE
// =====================================
function activarModalBotones() {
  const botones = document.querySelectorAll("[data-id]");
  botones.forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await abrirModal(id);
    });
  });
}

async function abrirModal(dealID) {
  try {
    const res = await fetch(`${DEAL_DETAIL_URL}${dealID}`);
    const data = await res.json();

    const game = data.gameInfo;

    modalImg.src = game.thumb;
    modalTitle.textContent = game.name;
    modalPrice.textContent = `Precio oferta: $${game.salePrice}`;
    modalNormalPrice.textContent = `Precio normal: $${game.retailPrice}`;
    modalLink.href = game.storeLink;

    detailModal.classList.remove("hidden");
  } catch (err) {
    showError("No se pudo cargar el detalle del juego.");
  }
}

closeModal.addEventListener("click", () => {
  detailModal.classList.add("hidden");
});

// =====================================
// CARGA INICIAL + PAGINACIÓN "VER MÁS"
// =====================================
async function cargarOfertas(p = 0) {
  try {
    setLoading(true);
    gamesGrid.innerHTML = "";
    errorText.classList.add("hidden");
    emptyMessage.classList.add("hidden");

    const url = `${DEALS_URL}?pageNumber=${p}&pageSize=12`;

    const res = await fetch(url);
    const data = await res.json();

    setLoading(false);

    if (!data || data.length === 0) {
      showEmpty();
      return;
    }

    renderGames(data);
    verMasBtn.classList.remove("hidden");
  } catch (err) {
    setLoading(false);
    showError("Error cargando ofertas.");
  }
}

verMasBtn.addEventListener("click", () => {
  pagina++;
  cargarOfertas(pagina);
});

// =====================================
// BÚSQUEDA DE JUEGOS
// =====================================
async function buscarJuegos() {
  textoBuscado = searchInput.value.trim();
  modoBusqueda = true;

  if (textoBuscado === "") {
    modoBusqueda = false;
    pagina = 0;
    cargarOfertas(0);
    return;
  }

  try {
    setLoading(true);
    gamesGrid.innerHTML = "";
    verMasBtn.classList.add("hidden");

    const res = await fetch(`${SEARCH_URL}${textoBuscado}&limit=20`);
    const data = await res.json();

    setLoading(false);

    if (!data || data.length === 0) {
      showEmpty();
      return;
    }

    renderGames(data);
  } catch (err) {
    setLoading(false);
    showError("Error al buscar videojuegos.");
  }
}

async function loadDealsFiltered(storeId) {
  showLoading();
  hideError();

  try {
      const url = `${API_BASE}/deals?storeID=${storeId}&pageSize=20`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Error al obtener datos");

      const data = await response.json();
      renderGames(data);

      hideLoading();

      if (data.length === 0) {
          showError("No hay juegos disponibles en esta tienda");
      }
  } catch (error) {
      showError("No se pudo cargar la información");
  }
}

// Eventos búsqueda
searchBtn.addEventListener("click", buscarJuegos);
searchInput.addEventListener("keyup", e => {
  if (e.key === "Enter") buscarJuegos();
});

// =====================================
// ORDENAR POR PRECIO
// =====================================
sortSelect.addEventListener("change", () => {
  let cards = [...gamesGrid.children];

  cards.sort((a, b) => {
    const pA = parseFloat(a.querySelector("p").textContent.replace("$", ""));
    const pB = parseFloat(b.querySelector("p").textContent.replace("$", ""));

    if (sortSelect.value === "priceAsc") return pA - pB;
    if (sortSelect.value === "priceDesc") return pB - pA;
    return 0;
  });

  gamesGrid.innerHTML = "";
  cards.forEach(c => gamesGrid.appendChild(c));
});

// =====================================
// FILTRO POR TIENDA
// =====================================
storeFilter.addEventListener("change", async () => {
  const tienda = storeFilter.value;
  pagina = 0;

  try {
    setLoading(true);
    gamesGrid.innerHTML = "";

    const url = tienda
      ? `${DEALS_URL}?storeID=${tienda}&pageSize=20`
      : `${DEALS_URL}?pageSize=20`;

    const res = await fetch(url);
    const data = await res.json();

    setLoading(false);

    if (!data || data.length === 0) {
      showEmpty();
      return;
    }

    renderGames(data);
    verMasBtn.classList.add("hidden"); // desactivar ver más en filtros
  } catch {
    setLoading(false);
    showError("Error al filtrar por tienda.");
  }
});

// =====================================
// EJECUCIÓN INICIAL
// =====================================
cargarOfertas(0);

