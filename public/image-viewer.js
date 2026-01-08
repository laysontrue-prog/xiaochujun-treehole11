class ImageViewer {
  constructor() {
    this.images = [];
    this.currentIndex = 0;
    this.scale = 1;
    this.isDragging = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentTranslate = { x: 0, y: 0 };
    this.prevTranslate = { x: 0, y: 0 };
    
    // Pinch zoom variables
    this.initialDistance = 0;
    this.initialScale = 1;

    this.initHTML();
    this.bindEvents();
  }

  initHTML() {
    if (document.querySelector('.image-viewer-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'image-viewer-overlay';
    overlay.innerHTML = `
      <div class="image-viewer-loader"></div>
      <div class="image-viewer-container">
        <img class="image-viewer-img" src="" alt="preview">
      </div>
      <div class="image-viewer-count"></div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.img = overlay.querySelector('.image-viewer-img');
    this.container = overlay.querySelector('.image-viewer-container');
    this.loader = overlay.querySelector('.image-viewer-loader');
    this.count = overlay.querySelector('.image-viewer-count');
  }

  bindEvents() {
    // Close on click outside (but not if dragging)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay || e.target === this.container) {
        this.close();
      }
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.close();
      }
    });

    // Touch events for swipe and zoom
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    // Mouse events for desktop dragging (if zoomed)
    this.container.addEventListener('mousedown', this.handleTouchStart.bind(this));
    this.container.addEventListener('mousemove', this.handleTouchMove.bind(this));
    this.container.addEventListener('mouseup', this.handleTouchEnd.bind(this));
    this.container.addEventListener('mouseleave', () => {
      if (this.isDragging) this.handleTouchEnd();
    });

    // Desktop zoom (wheel)
    this.container.addEventListener('wheel', (e) => {
      if (!this.overlay.classList.contains('active')) return;
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      const newScale = Math.min(Math.max(1, this.scale + delta), 4);
      this.setScale(newScale);
    }, { passive: false });
  }

  open(currentSrc, imageList = []) {
    this.images = imageList.length ? imageList : [currentSrc];
    this.currentIndex = this.images.indexOf(currentSrc);
    if (this.currentIndex === -1) this.currentIndex = 0;

    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    this.resetImageState();
    this.loadImage(this.currentIndex);
  }

  close() {
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
    // Wait for transition to finish before resetting to avoid visual jumping
    setTimeout(() => {
      this.resetImageState();
      this.img.src = ''; // Clear image to prevent residual display
    }, 300);
  }

  resetImageState() {
    this.scale = 1;
    this.currentTranslate = { x: 0, y: 0 };
    this.prevTranslate = { x: 0, y: 0 };
    this.updateTransform();
  }

  loadImage(index) {
    if (index < 0 || index >= this.images.length) return;

    this.loader.style.display = 'block';
    this.img.style.opacity = '0.5';
    
    const tempImg = new Image();
    tempImg.src = this.images[index];
    
    tempImg.onload = () => {
      this.img.src = this.images[index];
      this.img.style.opacity = '1';
      this.loader.style.display = 'none';
      this.updateCount();
      
      // Preload neighbors
      this.preload(index - 1);
      this.preload(index + 1);
    };

    tempImg.onerror = () => {
      this.loader.style.display = 'none';
      // Handle error?
    };
  }

  preload(index) {
    if (index >= 0 && index < this.images.length) {
      const img = new Image();
      img.src = this.images[index];
    }
  }

  updateCount() {
    if (this.images.length > 1) {
      this.count.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
      this.count.style.display = 'block';
    } else {
      this.count.style.display = 'none';
    }
  }

  handleTouchStart(e) {
    // Check for multi-touch (pinch)
    if (e.touches && e.touches.length === 2) {
      this.isDragging = false;
      this.initialDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      this.initialScale = this.scale;
      return;
    }

    this.isDragging = true;
    const point = e.touches ? e.touches[0] : e;
    this.startPoint = { x: point.clientX, y: point.clientY };
    
    // Stop transition during drag
    this.img.style.transition = 'none';
  }

  handleTouchMove(e) {
    if (e.cancelable) e.preventDefault(); // Prevent scrolling

    // Pinch zoom logic
    if (e.touches && e.touches.length === 2) {
      const currentDistance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const delta = currentDistance / this.initialDistance;
      this.setScale(this.initialScale * delta);
      return;
    }

    if (!this.isDragging) return;

    const point = e.touches ? e.touches[0] : e;
    const diffX = point.clientX - this.startPoint.x;
    const diffY = point.clientY - this.startPoint.y;

    if (this.scale > 1) {
      // Pan logic when zoomed
      this.currentTranslate.x = this.prevTranslate.x + diffX;
      this.currentTranslate.y = this.prevTranslate.y + diffY;
      this.updateTransform();
    } else {
      // Swipe logic when not zoomed (only horizontal)
      // Add resistance
      this.currentTranslate.x = diffX * 0.5; 
      this.updateTransform();
    }
  }

  handleTouchEnd(e) {
    this.isDragging = false;
    this.img.style.transition = 'transform 0.3s ease';

    if (this.scale > 1) {
      // Save current position for next drag
      this.prevTranslate = { ...this.currentTranslate };
      // Optional: Add bounds checking here to prevent panning too far
      return;
    }

    // Swipe threshold for changing image
    const threshold = 50;
    const moved = this.currentTranslate.x;

    if (Math.abs(moved) > threshold) {
      if (moved > 0 && this.currentIndex > 0) {
        this.currentIndex--;
        // Swipe animation handled by resetting state in loadImage
      } else if (moved < 0 && this.currentIndex < this.images.length - 1) {
        this.currentIndex++;
      }
    }

    this.resetImageState();
    this.loadImage(this.currentIndex);
  }

  setScale(newScale) {
    this.scale = Math.min(Math.max(1, newScale), 4);
    this.updateTransform();
  }

  updateTransform() {
    this.img.style.transform = `translate(${this.currentTranslate.x}px, ${this.currentTranslate.y}px) scale(${this.scale})`;
  }
}

// Global instance
window.imageViewer = new ImageViewer();

// Global click handler for images
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('post-image') || e.target.classList.contains('preview-image')) {
    // Prevent default new window opening
    e.preventDefault();
    e.stopPropagation();

    const src = e.target.src;
    // Try to find all images in the same container (post or comment)
    const container = e.target.closest('.post-images') || e.target.closest('.post-card') || document.body;
    // Find all images in that container
    const images = Array.from(container.querySelectorAll('img.post-image, img.preview-image')).map(img => img.src);
    
    window.imageViewer.open(src, images);
  }
}, true); // Use capture to bypass stopPropagation on parent containers
