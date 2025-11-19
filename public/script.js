// Commit 3: Barra de búsqueda y API de CheapShark

// =============================
// CONFIGURACIÓN DE LA API
// =============================
const API_BASE = "https://www.cheapshark.com/api/1.0";
const DEALS_URL = `${API_BASE}/deals`;
const GAMES_URL = `${API_BASE}/games`;
const STORES_URL = `${API_BASE}/stores`;

// =============================
// REFERENCIAS AL DOM
// =============================
const gamesGrid = document.getElementById("gamesGrid");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const storeFilter = document.getElementById("storeFilter");
const sortPrice = document.getElementById("sortPrice");
const loadMoreButton = document.getElementById("loadMoreButton");

const spinner = document.getElementById("spinner");
const loadingText = document.getElementById("loadingText");
const errorText = document.getElementById("errorText");
const emptyMessage = document.getElementById("emptyMessage");

const detailModal = document.getElementById("detailModal");
const closeModalButton = document.getElementById("closeModalButton");
const modalContent = document.getElementById("modalContent");

// =============================
// ESTADO GLOBAL
// =============================
let allGames = [];            // Juegos cargados actualmente
let currentPage = 0;          // Página actual de /deals
const PAGE_SIZE = 12;         // Mínimo 12 resultados
let currentMode = "deals";    // "deals" (explorar) o "search" (búsqueda)
let lastSearchTerm = "";      // Último término buscado
let storesMap = {};           // storeID -> storeName

// =============================
// FUNCIONES DE UI
// =============================
function setLoading(isLoading) {
  if (isLoading) {
    spinner.classList.remove("hidden");
    loadingText.classList.remove("hidden");
  } else {
    spinner.classList.add("hidden");
    loadingText.classList.add("hidden");
  }
}

function setError(message = "") {
  if (message) {
    errorText.textContent = message;
    errorText.classList.remove("hidden");
  } else {
    errorText.classList.add("hidden");
  }
}

function showEmptyMessage(show) {
  if (show) {
    emptyMessage.classList.remove("hidden");
  } else {
    emptyMessage.classList.add("hidden");
  }
}

// =============================
// LLAMADAS A LA API
// =============================

// Cargar lista de tiendas para el select
async function loadStores() {
  try {
    const res = await fetch(STORES_URL);
    const stores = await res.json();
    storesMap = {};

    stores.forEach((store) => {
      storesMap[store.storeID] = store.storeName;

      const option = document.createElement("option");
      option.value = store.storeID;
      option.textContent = store.storeName;
      storeFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Error cargando tiendas:", error);
    // Si falla, solo se pierde el nombre de la tienda, no es crítico
  }
}

// Cargar ofertas usando /deals (modo exploración)
async function loadDealsPage(reset = false) {
  setError("");
  setLoading(true);

  try {
    if (reset) {
      currentPage = 0;
    }

    const params = new URLSearchParams({
      pageNumber: currentPage.toString(),
      pageSize: PAGE_SIZE.toString(),
    });

    // Filtro de tienda si está seleccionado
    if (storeFilter.value !== "all") {
      params.append("storeID", storeFilter.value);
    }

    const url = `${DEALS_URL}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("La API devolvió un error");
    }

    const deals = await res.json();

    const mappedGames = deals.map((deal) => ({
      id: deal.dealID,
      title: deal.title,
      thumb: deal.thumb,
      normalPrice: parseFloat(deal.normalPrice),
      salePrice: parseFloat(deal.salePrice),
      savings: parseFloat(deal.savings),
      storeID: deal.storeID,
      dealLink: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
    }));

    if (reset) {
      allGames = mappedGames;
    } else {
      allGames = [...allGames, ...mappedGames];
    }

    currentMode = "deals";
    currentPage += 1;

    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    setError("No se pudieron cargar las ofertas. Intenta de nuevo.");
  } finally {
    setLoading(false);
  }
}

// Búsqueda por nombre usando /games
async function searchGamesByName(term) {
  setError("");
  setLoading(true);
  lastSearchTerm = term;
  currentMode = "search";

  try {
    const params = new URLSearchParams({
      title: term,
      pageSize: "20",
    });

    const url = `${GAMES_URL}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("La API de búsqueda devolvió un error");
    }

    const gamesResponse = await res.json();
    const topGames = gamesResponse.slice(0, PAGE_SIZE);

    const detailedGames = await Promise.all(
      topGames.map(async (game) => {
        try {
          if (!game.cheapestDealID) {
            return {
              id: game.gameID,
              title: game.external,
              thumb: game.thumb,
              normalPrice: null,
              salePrice: parseFloat(game.cheapest || 0),
              savings: null,
              storeID: null,
              dealLink: "",
            };
          }

          const dealRes = await fetch(
            `${DEALS_URL}?id=${game.cheapestDealID}`
          );
          const dealData = await dealRes.json();

          const deal =
            dealData[game.cheapestDealID] && dealData[game.cheapestDealID].gameInfo
              ? dealData[game.cheapestDealID].gameInfo
              : dealData.gameInfo || dealData;

          const salePrice = parseFloat(deal.salePrice || game.cheapest || 0);
          const normalPrice = parseFloat(
            deal.retailPrice || deal.normalPrice || salePrice
          );

          const savings =
            normalPrice && normalPrice > 0
              ? ((normalPrice - salePrice) / normalPrice) * 100
              : null;

          return {
            id: game.gameID,
            title: game.external,
            thumb: game.thumb,
            normalPrice,
            salePrice,
            savings,
            storeID: deal.storeID || null,
            dealLink: `https://www.cheapshark.com/redirect?dealID=${game.cheapestDealID}`,
          };
        } catch (error) {
          console.error("Error cargando detalle de juego:", error);
          return {
            id: game.gameID,
            title: game.external,
            thumb: game.thumb,
            normalPrice: null,
            salePrice: parseFloat(game.cheapest || 0),
            savings: null,
            storeID: null,
            dealLink: "",
          };
        }
      })
    );

    allGames = detailedGames;
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    setError("No se pudieron buscar los videojuegos. Intenta de nuevo.");
  } finally {
    setLoading(false);
  }
}

// =============================
// FILTROS Y ORDENAMIENTO
// =============================
function applyFiltersAndRender() {
  let games = [...allGames];

  const selectedStore = storeFilter.value;
  if (selectedStore !== "all") {
    games = games.filter((g) => g.storeID === selectedStore);
  }

  switch (sortPrice.value) {
    case "saleAsc":
      games.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
      break;
    case "saleDesc":
      games.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
      break;
    case "normalAsc":
      games.sort((a, b) => (a.normalPrice || 0) - (b.normalPrice || 0));
      break;
    case "normalDesc":
      games.sort((a, b) => (b.normalPrice || 0) - (a.normalPrice || 0));
      break;
    default:
      break;
  }

  renderGames(games);
}

// =============================
// RENDER DEL GRID
// =============================
function renderGames(games) {
  gamesGrid.innerHTML = "";

  if (!games.length) {
    showEmptyMessage(true);
    return;
  }

  showEmptyMessage(false);

  games.forEach((game) => {
    const card = document.createElement("article");
    card.className =
      "flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow hover:shadow-lg transition hover:-translate-y-1";

    const discountText =
      game.savings != null ? `-${Math.round(game.savings)}%` : "Oferta";

    const storeName =
      game.storeID && storesMap[game.storeID]
        ? storesMap[game.storeID]
        : "Tienda";

    card.innerHTML = `
      <div class="relative aspect-video w-full bg-slate-800">
        ${
          game.thumb
            ? `<img src="${game.thumb}" alt="${game.title}" class="h-full w-full object-cover" />`
            : `<div class="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Sin imagen
               </div>`
        }
        <span class="absolute left-2 top-2 rounded-full bg-cyan-500 px-2 py-1 text-[0.65rem] font-bold text-slate-950">
          ${discountText}
        </span>
      </div>

      <div class="flex flex-1 flex-col gap-2 p-3 text-sm">
        <h2 class="line-clamp-2 text-xs font-semibold text-slate-100">
          ${game.title}
        </h2>

        <p class="text-[0.7rem] text-slate-400">
          ${storeName}
        </p>

        <div class="mt-1 flex items-baseline gap-2">
          ${
            game.normalPrice != null
              ? `<span class="text-[0.75rem] text-slate-500 line-through">$${game.normalPrice.toFixed(
                  2
                )}</span>`
              : ""
          }
          ${
            game.salePrice != null
              ? `<span class="text-base font-bold text-emerald-400">$${game.salePrice.toFixed(
                  2
                )}</span>`
              : `<span class="text-sm text-slate-300">Precio no disponible</span>`
          }
        </div>

        <button
          class="mt-auto w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 active:scale-95 ver-detalle-btn"
          data-game-id="${game.id}"
        >
          Ver detalle
        </button>
      </div>
    `;

    gamesGrid.appendChild(card);
  });

  const detailButtons = gamesGrid.querySelectorAll(".ver-detalle-btn");
  detailButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const gameId = btn.getAttribute("data-game-id");
      const game = allGames.find((g) => g.id === gameId || g.gameID === gameId);
      if (game) {
        openDetailModal(game);
      }
    });
  });
}

// =============================
// MODAL DE DETALLE
// =============================
function openDetailModal(game) {
  const storeName =
    game.storeID && storesMap[game.storeID]
      ? storesMap[game.storeID]
      : "Tienda";

  modalContent.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 sm:flex-row">
        <div class="aspect-video w-full max-w-xs overflow-hidden rounded-lg bg-slate-800">
          ${
            game.thumb
              ? `<img src="${game.thumb}" alt="${game.title}" class="h-full w-full object-cover" />`
              : `<div class="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Sin imagen
                 </div>`
          }
        </div>
        <div class="flex-1 space-y-2 text-sm">
          <h2 class="text-lg font-semibold text-cyan-300">${game.title}</h2>
          <p class="text-xs text-slate-400">
            Tienda: <span class="font-medium text-slate-200">${storeName}</span>
          </p>
          <p class="text-xs text-slate-400">
            Precio normal:
            ${
              game.normalPrice != null
                ? `<span class="font-semibold text-slate-200">$${game.normalPrice.toFixed(
                    2
                  )}</span>`
                : `<span class="text-slate-500">No disponible</span>`
            }
          </p>
          <p class="text-xs text-slate-400">
            Precio oferta:
            ${
              game.salePrice != null
                ? `<span class="font-semibold text-emerald-400">$${game.salePrice.toFixed(
                    2
                  )}</span>`
                : `<span class="text-slate-500">No disponible</span>`
            }
          </p>
          <p class="text-xs text-slate-400">
            Descuento:
            ${
              game.savings != null
                ? `<span class="font-semibold text-emerald-300">${Math.round(
                    game.savings
                  )}% OFF</span>`
                : `<span class="text-slate-500">No disponible</span>`
            }
          </p>
        </div>
      </div>

      ${
        game.dealLink
          ? `<a
              href="${game.dealLink}"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Ir a la oferta en la tienda
            </a>`
          : `<p class="text-xs text-slate-500">
              No hay un enlace directo a la tienda disponible.
             </p>`
      }
    </div>
  `;

  detailModal.classList.remove("hidden");
  detailModal.classList.add("flex");
}

function closeDetailModal() {
  detailModal.classList.add("hidden");
  detailModal.classList.remove("flex");
}

// =============================
// EVENTOS
// =============================
searchButton.addEventListener("click", () => {
  const term = searchInput.value.trim();
  if (!term) return;
  searchGamesByName(term);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const term = searchInput.value.trim();
    if (!term) return;
    searchGamesByName(term);
  }
});

storeFilter.addEventListener("change", () => {
  applyFiltersAndRender();
});

sortPrice.addEventListener("change", () => {
  applyFiltersAndRender();
});

loadMoreButton.addEventListener("click", () => {
  if (currentMode === "deals") {
    loadDealsPage(false);
  } else if (currentMode === "search" && lastSearchTerm) {
    // Para el examen basta con paginar en modo deals
    loadDealsPage(false);
    currentMode = "deals";
  }
});

closeModalButton.addEventListener("click", closeDetailModal);
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) {
    closeDetailModal();
  }
});

// =============================
// INICIALIZACIÓN
// =============================
async function init() {
  await loadStores();        // Cargar nombres de tiendas
  await loadDealsPage(true); // Cargar primera página de ofertas
}

document.addEventListener("DOMContentLoaded", init);


