const PROCESS_NOTE_URL = "http://127.0.0.1:8000/process";

async function getCurrentUser() {
    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("Error getting user:", error);
        return null;
    }

    return user;
}


async function getUserClinicalNotes(userId) {
    const {
        data,
        error
    } = await supabaseClient
        .from("clinical_notes")
        .select("id, filename, created_at, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}


async function loadClinicalNotes() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    console.log("Logged in user:", user.id);

    const container = document.getElementById("notes-container");

    container.innerHTML = "";

    let notes;
    try {
        notes = await getUserClinicalNotes(user.id);
    } catch (error) {
        console.error("Unable to load clinical notes:", error);
        container.innerHTML = `
            <p class="notes-error" role="alert">
                We couldn't load your notes. Please refresh and try again.
            </p>
        `;
        return;
    }

    if (notes.length === 0) {
        container.innerHTML = `
            <div class="notes-empty">
                <span class="notes-empty__icon" aria-hidden="true">✦</span>
                <h3>No notes yet</h3>
                <p>Your scanned consultation notes will appear here.</p>
            </div>
        `;
        return;
    }

    notes.forEach(note => {
        const noteElement = document.createElement("a");
        noteElement.classList.add("note-item");
        noteElement.href = `note.html?note_id=${encodeURIComponent(note.id)}`;

        noteElement.innerHTML = `
            <div class="note-item__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path>
                    <path d="M14 3v5h5M9 13h6M9 17h4"></path>
                </svg>
            </div>
            <div class="note-item__content">
                <h3>${escapeHTML(note.filename)}</h3>
                <span>${formatDate(note.created_at)}</span>
            </div>
            <span class="note-status">
                ${escapeHTML(note.status)}
            </span>
            <svg class="note-item__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"></path>
            </svg>
        `;

        container.appendChild(noteElement);
    });
}


function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}


function formatDate(dateString) {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function setupUploadForm() {
    const form = document.getElementById("note-upload-form");
    const imageInput = document.getElementById("image-scanner");
    const filenameInput = document.getElementById("note-filename");
    const uploadMessage = document.getElementById("upload-message");

    imageInput.addEventListener("change", () => {
        const file = imageInput.files[0];

        if (file && !filenameInput.value.trim()) {
            filenameInput.value = file.name;
        }

        uploadMessage.textContent = file
            ? `${file.name} is ready to submit.`
            : "";
        uploadMessage.classList.remove("upload-message--error");
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const file = imageInput.files[0];
        const filename = filenameInput.value.trim();
        const submitButton = form.querySelector('button[type="submit"]');
        const submitButtonText = submitButton.querySelector("span");

        if (!file || !filename) {
            uploadMessage.textContent = "Choose an image and enter a filename.";
            uploadMessage.classList.add("upload-message--error");
            return;
        }

        submitButton.disabled = true;
        submitButtonText.textContent = "Uploading...";
        uploadMessage.textContent = "";
        uploadMessage.classList.remove("upload-message--error");

        try {
            const { data: { session }, error: sessionError } =
                await supabaseClient.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            if (!session?.access_token) {
                window.location.href = "login.html";
                return;
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("filename", filename);

            const response = await fetch(PROCESS_NOTE_URL, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail || "The note could not be uploaded."
                );
            }

            uploadMessage.textContent =
                result.message || "Clinical note uploaded successfully.";
            form.reset();
            await loadClinicalNotes();
        } catch (error) {
            console.error("Unable to upload clinical note:", error);
            uploadMessage.textContent =
                error.message || "The note could not be uploaded. Please try again.";
            uploadMessage.classList.add("upload-message--error");
        } finally {
            submitButton.disabled = false;
            submitButtonText.textContent = "Submit note";
        }
    });
}


(async () => {
    setupUploadForm();
    await loadClinicalNotes();
})();