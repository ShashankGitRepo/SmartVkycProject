const submitButton = document.getElementById('submitButton');
const documentInput = document.getElementById('document');
const docTypeInput = document.getElementById('docType');
const resultsDiv = document.getElementById('results');
const resultsContent = document.getElementById('results-content');
const instructionText = document.getElementById('instruction-text');

let documentFile = null;

// --- 1. Authentication Check ---
window.addEventListener('load', () => {
    const authToken = localStorage.getItem('token'); // Consistent with dashboard.js
    if (!authToken) {
        window.location.href = '/login';
    }
});

// --- 2. File Selection Logic ---
documentInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
        documentFile = event.target.files[0];
        instructionText.textContent = 'Document selected. Ready to upload.';
        submitButton.disabled = false;
        submitButton.style.backgroundColor = '#1a73e8'; // Active Blue
    } else {
        documentFile = null;
        instructionText.textContent = 'Please select a file.';
        submitButton.disabled = true;
        submitButton.style.backgroundColor = '#5f6368'; // Disabled Grey
    }
});

// --- 3. Submit / Upload Logic ---
submitButton.addEventListener('click', async () => {
    if (!documentFile) return;

    const authToken = localStorage.getItem('token');
    const selectedDocType = docTypeInput.value;

    // UI Updates
    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";
    instructionText.textContent = 'Processing document...';
    resultsDiv.style.display = 'none';

    // Create Dummy Video (Backend expects 'video' field)
    const dummyVideoBlob = new Blob(["dummy data"], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('document', documentFile);
    formData.append('video', dummyVideoBlob, 'dummy.mp4');

    try {
        // Send Request
        const response = await fetch(`http://localhost:8000/api/v1/verify?doc_type=${encodeURIComponent(selectedDocType)}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await response.json();

        if (response.status === 401) {
            alert('Session expired. Please log in again.');
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }

        resultsDiv.style.display = 'block';
        
        const docStatus = data.checks.document ? data.checks.document.status : "UNKNOWN";
        
        if (docStatus === "VERIFIED") {
            resultsDiv.className = 'pass';
            resultsContent.textContent = "Success: Document Verified Successfully. You may now proceed to the meeting.";
            instructionText.textContent = "Verification Complete.";
            
            setTimeout(() => {
                if(confirm("Document verified! Return to dashboard?")) {
                    window.location.href = '/dashboard';
                }
            }, 1000);

        } else {
            resultsDiv.className = 'fail';
            const reason = data.checks.document ? data.checks.document.reason : "Unknown error";
            resultsContent.textContent = `Issue: ${reason}`;
            instructionText.textContent = "Please upload a clearer photo.";
        }

    } catch (error) {
        console.error(error);
        resultsContent.textContent = "Error connecting to server.";
        resultsDiv.style.display = 'block';
        resultsDiv.className = 'fail';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Upload & Verify";
    }
});