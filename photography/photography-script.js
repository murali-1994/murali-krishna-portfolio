/**
 * Photography Gallery
 * Masonry layout preserving original image aspect ratios
 */

// Static Asset Mapping (44 images)
const imageCount = 43;

const images = Array.from({ length: imageCount }, (_, i) => ({
    id: i + 1,
    src: `https://res.cloudinary.com/dodnfkmjq/image/upload/v1778827757/murali-krishna-portfolio/photography/${i + 1}.webp`,
    alt: `Gallery image ${i + 1}`
}));

// Masonry Layout Engine
function buildMasonryGrid(images, columns = 3) {
    const container = document.getElementById('galleryGrid');
    container.innerHTML = '';
    container.style.columns = columns;
    container.style.columnGap = '20px';

    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'masonry-item';
        item.style.cssText = 'break-inside: avoid; margin-bottom: 20px; position: relative; border-radius: 8px; overflow: hidden; cursor: pointer;';

        const img = document.createElement('img');
        img.alt = image.alt;
        img.decoding = 'async';
        img.style.cssText = 'width: 100%; display: block;';

        // Skeleton placeholder
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton';
        skeleton.style.cssText = 'position: absolute; inset: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%);';

        // Overlay on hover
        const overlay = document.createElement('div');
        overlay.className = 'item-overlay';
        overlay.style.cssText = 'position: absolute; inset: 0; background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6) 100%); opacity: 0; transition: opacity 0.3s ease; display: flex; align-items: flex-end; padding: 20px;';

        const imageNum = document.createElement('span');
        imageNum.className = 'image-num';
        imageNum.textContent = `${image.id}`;
        imageNum.style.cssText = 'color: white; font-size: 0.8rem; font-weight: 500; letter-spacing: 0.05em; opacity: 0; transform: translateY(10px); transition: all 0.3s ease;';

        // overlay.appendChild(imageNum);

        // Initial state - start hidden then fade in
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        item.classList.add('not-loaded');

        let hasLoaded = false;
        const handleLoad = (isCached = false) => {
            if (hasLoaded) return;
            hasLoaded = true;
            item.classList.add('loaded');

            if (isCached) {
                // Skip staggered animation for cached images (e.g., on resize)
                item.style.transition = 'none';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
                setTimeout(() => {
                    item.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                }, 50);
            } else {
                // Staggered entrance animation on first load
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 30);
            }
        };

        img.onload = () => handleLoad(false);
        img.onerror = () => {
            if (hasLoaded) return;
            // Fallback for broken images
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23222" width="100" height="100"/></svg>';
            handleLoad(false);
        };

        // Set src after attaching event listeners
        img.src = image.src;

        // Check if image is already cached
        if (img.complete) {
            if (img.naturalWidth === 0) {
                img.onerror();
            } else {
                handleLoad(true);
            }
        }

        item.appendChild(skeleton);
        item.appendChild(img);
        item.appendChild(overlay);

        // Event handlers
        item.addEventListener('click', () => openLightbox(image, index));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(image, index);
            }
        });
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `View ${image.alt}`);

        // Hover states
        item.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.03)';
            overlay.style.opacity = '1';
            imageNum.style.opacity = '1';
            imageNum.style.transform = 'translateY(0)';
        });
        item.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
            overlay.style.opacity = '0';
            imageNum.style.opacity = '0';
            imageNum.style.transform = 'translateY(10px)';
        });

        container.appendChild(item);
    });
}

// Responsive column handling
function handleColumns() {
    const width = window.innerWidth;
    let columns = 3;
    if (width < 768) columns = 2;
    if (width < 480) columns = 1;
    buildMasonryGrid(images, columns);
}

// Lightbox functionality
const lightbox = document.getElementById('lightbox');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxCounter = document.getElementById('lightboxCounter');

let currentIndex = 0;

function openLightbox(image, index) {
    currentIndex = index;
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCounter.textContent = `${index + 1} / ${images.length}`;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    lightboxClose.focus();
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateLightbox(direction) {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    const image = images[currentIndex];
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    lightboxCounter.textContent = `${currentIndex + 1} / ${images.length}`;
}

// Lightbox event listeners
lightboxClose.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);

document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
});

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

// Initialize
window.addEventListener('resize', handleColumns);
handleColumns();