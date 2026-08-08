  // ============================================
        // CHECK TESSERACT AVAILABILITY
        // ============================================
        if (typeof Tesseract === 'undefined') {
            console.error('Tesseract.js not loaded. Check CDN connection.');
            alert('OCR library failed to load. Please refresh the page.');
        }

        // ============================================
        // CORE APPLICATION STATE & DOM ELEMENTS
        // ============================================
        const state = {
            selectedFile: null,
            isProcessing: false,
            worker: null
        };

        const elements = {
            // File input
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            uploadContent: document.getElementById('uploadContent'),
            previewArea: document.getElementById('previewArea'),
            imagePreview: document.getElementById('imagePreview'),
            btnChangeFile: document.getElementById('btnChangeFile'),
            fileInfo: document.getElementById('fileInfo'),

            // Result area
            resultText: document.getElementById('resultText'),
            btnCopy: document.getElementById('btnCopy'),
            btnDownload: document.getElementById('btnDownload'),

            // Progress
            progressOverlay: document.getElementById('progressOverlay'),
            progressText: document.getElementById('progressText'),
            progressBar: document.getElementById('progressBar'),
            progressPercent: document.getElementById('progressPercent'),

            // Actions
            btnConvert: document.getElementById('btnConvert'),

            // Toast
            toast: document.getElementById('toast')
        };

        // ============================================
        // FILE HANDLING
        // ============================================
        
        // Prevent default drag behavior
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            elements.dropZone.addEventListener(event, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Visual feedback during drag
        ['dragenter', 'dragover'].forEach(event => {
            elements.dropZone.addEventListener(event, () => {
                elements.dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            elements.dropZone.addEventListener(event, () => {
                elements.dropZone.classList.remove('dragover');
            });
        });

        // Handle file drop
        elements.dropZone.addEventListener('drop', e => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        // Handle file input change
        elements.fileInput.addEventListener('change', e => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        // Change image button
        elements.btnChangeFile.addEventListener('click', e => {
            e.stopPropagation();
            resetFileSelection();
            elements.fileInput.click();
        });

        function handleFileSelect(file) {
            if (!file.type.startsWith('image/')) {
                showToast('Please upload an image file (JPG, PNG, WEBP, etc.)');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('File size must be less than 10MB');
                return;
            }

            state.selectedFile = file;

            // Show preview
            const reader = new FileReader();
            reader.onload = e => {
                elements.imagePreview.src = e.target.result;
                elements.uploadContent.classList.add('hidden');
                elements.previewArea.classList.remove('hidden');
            };
            reader.readAsDataURL(file);

            // Update UI
            elements.fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            elements.btnConvert.disabled = false;
            elements.resultText.value = '';
            elements.btnCopy.disabled = true;
            elements.btnDownload.disabled = true;
        }

        function resetFileSelection() {
            state.selectedFile = null;
            elements.fileInput.value = '';
            elements.imagePreview.src = '';
            elements.uploadContent.classList.remove('hidden');
            elements.previewArea.classList.add('hidden');
            elements.fileInfo.textContent = 'Ready to extract text';
            elements.btnConvert.disabled = true;
            elements.resultText.value = '';
            elements.btnCopy.disabled = true;
            elements.btnDownload.disabled = true;
        }

        // ============================================
        // OCR PROCESSING
        // ============================================

        elements.btnConvert.addEventListener('click', async () => {
            if (!state.selectedFile || state.isProcessing) return;

            state.isProcessing = true;
            showProgress();
            elements.btnConvert.disabled = true;

            try {
                // Read file as data URL
                const imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsDataURL(state.selectedFile);
                });

                console.log('File loaded, initializing OCR worker...');
                updateProgressStatus('Loading OCR engine (first time may take 30-60 seconds)...');

                // Create worker with proper config
                state.worker = await Tesseract.createWorker({
                    logger: updateProgress
                });

                console.log('Worker created, loading language...');
                updateProgressStatus('Loading language models...');
                
                // Initialize with language
                await state.worker.load();
                await state.worker.loadLanguage('eng');
                await state.worker.initialize('eng');

                console.log('Worker initialized, starting recognition...');
                updateProgressStatus('Extracting text from image...');
                
                const result = await state.worker.recognize(imageData);
                const text = result.data.text;
                
                console.log('OCR Result:', text);
                
                // Handle result
                const cleanedText = text.trim();
                elements.resultText.value = cleanedText || '[No text detected in image]';

                if (cleanedText) {
                    elements.btnCopy.disabled = false;
                    elements.btnDownload.disabled = false;
                    showToast('Text extraction completed successfully');
                } else {
                    showToast('No text detected. Try with a clearer image.');
                }

                // Cleanup
                console.log('Terminating worker...');
                await state.worker.terminate();
                state.worker = null;

            } catch (error) {
                console.error('OCR Error:', error);
                console.error('Error stack:', error.stack);
                elements.resultText.value = `Error: ${error.message || 'Failed to process image. Please try again.'}`;
                showToast('Error during text extraction - check console for details');
            } finally {
                hideProgress();
                state.isProcessing = false;
                elements.btnConvert.disabled = !state.selectedFile;
            }
        });

        function updateProgress(message) {
            console.log('Progress update:', message);
            
            const statuses = {
                'loading tesseract core': 'Loading OCR engine (might take 30-60 seconds first time)...',
                'initializing tesseract': 'Initializing OCR system...',
                'loading language traineddata': 'Downloading language models (~30MB)...',
                'recognizing text': 'Extracting text from image...'
            };

            if (message.status in statuses) {
                updateProgressStatus(statuses[message.status]);
            }

            if (message.progress !== undefined) {
                const percent = Math.round(message.progress * 100);
                elements.progressBar.style.width = `${percent}%`;
                elements.progressPercent.textContent = `${percent}%`;
            }
        }

        function updateProgressStatus(text) {
            elements.progressText.textContent = text;
        }

        function showProgress() {
            elements.progressOverlay.classList.remove('hidden');
            elements.progressBar.style.width = '0%';
            elements.progressPercent.textContent = '0%';
        }

        function hideProgress() {
            elements.progressOverlay.classList.add('hidden');
        }

        // ============================================
        // RESULT ACTIONS
        // ============================================

        elements.btnCopy.addEventListener('click', () => {
            if (!elements.resultText.value) return;

            navigator.clipboard.writeText(elements.resultText.value)
                .then(() => showToast('Text copied to clipboard'))
                .catch(() => showToast('Failed to copy text'));
        });

        elements.btnDownload.addEventListener('click', () => {
            if (!elements.resultText.value) return;

            const blob = new Blob([elements.resultText.value], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ScanText-${Date.now()}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('Text file downloaded successfully');
        });

        // ============================================
        // NOTIFICATIONS
        // ============================================

        function showToast(message) {
            elements.toast.textContent = message;
            elements.toast.classList.add('show');
            setTimeout(() => {
                elements.toast.classList.remove('show');
            }, 3000);
        }
