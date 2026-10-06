const noteOutput = document.getElementById("note-output");
const noteMessage = document.getElementById("note-message");

function formatLabel(value) {
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, character => character.toUpperCase());
}

function renderValue(value) {
    if (value === null || value === undefined || value === "") {
        const empty = document.createElement("p");
        empty.className = "note-value note-value--empty";
        empty.textContent = "Not recorded";
        return empty;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            const empty = document.createElement("p");
            empty.className = "note-value note-value--empty";
            empty.textContent = "None recorded";
            return empty;
        }

        const list = document.createElement("ul");
        list.className = "note-value-list";

        value.forEach(item => {
            const listItem = document.createElement("li");
            listItem.appendChild(renderValue(item));
            list.appendChild(listItem);
        });
        return list;
    }

    if (typeof value === "object") {
        const group = document.createElement("dl");
        group.className = "note-nested-fields";

        Object.entries(value).forEach(([key, nestedValue]) => {
            const field = document.createElement("div");
            field.className = "note-field note-field--nested";

            const label = document.createElement("dt");
            label.textContent = formatLabel(key);

            const detail = document.createElement("dd");
            detail.appendChild(renderValue(nestedValue));

            field.append(label, detail);
            group.appendChild(field);
        });
        return group;
    }

    const text = document.createElement("p");
    text.className = "note-value";
    text.textContent = String(value);
    return text;
}

function renderOutput(output) {
    if (!output || typeof output !== "object" || Array.isArray(output)) {
        throw new Error("The saved note data has an unexpected format.");
    }

    const fields = document.createDocumentFragment();

    Object.entries(output).forEach(([key, value]) => {
        const field = document.createElement("section");
        field.className = "note-field";

        const label = document.createElement("h2");
        label.className = "note-field__label";
        label.textContent = formatLabel(key);

        field.append(label, renderValue(value));
        fields.appendChild(field);
    });

    noteOutput.replaceChildren(fields);
}

async function loadNote() {
    const noteId = new URLSearchParams(window.location.search).get("note_id");

    if (!noteId) {
        noteMessage.textContent = "No note ID was provided. Open a note from your dashboard.";
        return;
    }

    const {
        data: { session },
        error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
        throw sessionError;
    }

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    const { data: note, error: noteError } = await supabaseClient
        .from("clinical_notes")
        .select("id")
        .eq("id", noteId)
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (noteError) {
        throw noteError;
    }

    if (!note) {
        noteMessage.textContent = "This note could not be found in your account.";
        return;
    }

    const { data, error } = await supabaseClient
        .from("final_outputs")
        .select("note_id, output, created_at")
        .eq("note_id", noteId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        noteMessage.textContent = "No extracted information was found for this note.";
        return;
    }

    document.getElementById("note-id").textContent = data.note_id;
    document.getElementById("note-created-at").textContent = data.created_at
        ? new Date(data.created_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
        })
        : "Date unavailable";

    renderOutput(data.output);
    noteMessage.hidden = true;
    noteOutput.hidden = false;
}

document.getElementById("logout-btn").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error("Unable to sign out:", error);
        noteMessage.hidden = false;
        noteMessage.textContent = "Unable to log out. Please try again.";
        return;
    }
    window.location.href = "login.html";
});

loadNote().catch(error => {
    console.error("Unable to load note:", error);
    noteMessage.hidden = false;
    noteMessage.textContent =
        "We couldn't load this note. Please refresh and try again.";
});