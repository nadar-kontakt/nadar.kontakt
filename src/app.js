// Local memory state fallback / reactive store
let itemsList = [];

// 1. FETCH ITEMS FROM SUPABASE ON PAGE LOAD (ONLY LAST 14 DAYS)
async function fetchItems() {
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">Učitavanje oglasa...</div>';

  // Calculate timestamp for 14 days ago to keep feed fresh
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('*')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Greška pri dohvaćanju oglasa:', error);
      grid.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">Došlo je do greške pri učitavanju. Provjerite vezu.</div>';
      return;
    }

    itemsList = data || [];
    renderItems(itemsList);

    // Update live header counter badge
    const itemCountBadge = document.getElementById('itemCount');
    if (itemCountBadge) {
      itemCountBadge.innerText = itemsList.length;
    }
  } catch (err) {
    console.error('Neočekivana greška:', err);
  }
}

// HELPER: CALCULATE TIME AGO / DAYS REMAINING
function getTimeAgoText(createdAt) {
  if (!createdAt) return 'Aktivno (14 dana)';
  
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffInMs = now - createdDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays <= 0) {
    return '⏱️ Objavljeno danas';
  } else if (diffInDays === 1) {
    return '⏱️ Prije 1 dan';
  } else {
    return `⏱️ Prije ${diffInDays} dana`;
  }
}

// 2. RENDER CARD GRID
function renderItems(itemsToRender) {
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '';

  if (itemsToRender.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
        <span class="text-4xl block mb-2">🎁</span>
        <h3 class="font-bold text-gray-700 text-lg">Trenutno nema objavljenih stvari</h3>
        <p class="text-xs text-gray-500 mt-1">Budi prvi koji će pokloniti nešto sugrađanima u Tuzli!</p>
      </div>
    `;
    return;
  }

  itemsToRender.forEach(item => {
    const defaultImg = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=600&q=80';
    const timeAgoText = getTimeAgoText(item.created_at);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 overflow-hidden flex flex-col justify-between transition group';

    card.innerHTML = `
      <div>
        <div class="relative h-48 bg-gray-100 overflow-hidden">
          <img src="${item.image_url || defaultImg}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <span class="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
            ${item.neighborhood}
          </span>
          <span class="absolute top-3 right-3 bg-slate-900/70 backdrop-blur-md text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow">
            ${timeAgoText}
          </span>
        </div>
        <div class="p-4">
          <h3 class="font-bold text-gray-900 text-base mb-1 line-clamp-1">${item.title}</h3>
          <p class="text-xs text-gray-600 line-clamp-2 mb-3">${item.description || 'Nema opisa.'}</p>
        </div>
      </div>
      <div class="px-4 pb-4 pt-0 space-y-2">
        <a href="tel:${item.phone}" class="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition">
          <span>📞 Nazovi / Viber (${item.phone})</span>
        </a>
        ${item.email ? `
          <a href="mailto:${item.email}" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition">
            <span>✉️ Pošalji email (${item.email})</span>
          </a>
        ` : ''}
      </div>
    `;

    grid.appendChild(card);
  });
}

// 3. FILTER BY NEIGHBORHOOD
function filterFeed() {
  const selected = document.getElementById('filterNeighborhood').value;
  if (selected === 'ALL') {
    renderItems(itemsList);
  } else {
    const filtered = itemsList.filter(item => item.neighborhood === selected);
    renderItems(filtered);
  }
}

// 4. MODAL TOGGLE
function toggleModal(show) {
  const modal = document.getElementById('postModal');
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

// 5. HANDLE FORM SUBMISSION (INSERT INTO SUPABASE)
async function handleFormSubmit(event) {
  event.preventDefault();

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerText;
  submitBtn.innerText = 'Objavljivanje...';
  submitBtn.disabled = true;

  const title = document.getElementById('titleInput').value.trim();
  const neighborhood = document.getElementById('neighborhoodInput').value;
  const phone = document.getElementById('phoneInput').value.trim();
  const email = document.getElementById('emailInput') ? document.getElementById('emailInput').value.trim() : '';
  const description = document.getElementById('descInput').value.trim();
  const imageFile = document.getElementById('imageInput').files[0];

  let imageUrl = '';

  // Compress and process image to max 720p JPEG before sending to Supabase
  if (imageFile) {
    try {
      imageUrl = await compressImage(imageFile, 1280, 0.7);
    } catch (err) {
      console.error('Greška pri obradi slike:', err);
    }
  }

  const newItem = {
    title,
    neighborhood,
    phone,
    email,
    description,
    image_url: imageUrl
  };

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .insert([newItem])
      .select();

    if (error) {
      alert('Greška pri objavi oglasa: ' + error.message);
      console.error(error);
    } else {
      document.getElementById('itemForm').reset();
      toggleModal(false);

      // Trigger the "Broken Bread" celebration overlay!
      const overlay = document.getElementById('breadOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
          overlay.classList.add('hidden');
        }, 3500); // Displays for 3.5 seconds of celebratory warmth
      }

      // Refresh the feed directly from Supabase
      await fetchItems();
    }
  } catch (err) {
    console.error('Neočekivana greška:', err);
  } finally {
    submitBtn.innerText = originalBtnText;
    submitBtn.disabled = false;
  }
}
// HELPER: RESIZE & COMPRESS IMAGE TO 720p JPEG BEFORE UPLOAD
function compressImage(file, maxDimension = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate 720p scaling while maintaining aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Draw resized image on HTML5 canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export compressed JPEG base64 string
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = (error) => reject(error);
    };

    reader.onerror = (error) => reject(error);
  });
}

// Initial fetch on page load
document.addEventListener('DOMContentLoaded', fetchItems);