(function () {
    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        const list = document.getElementById("home-question-list");
        const status = document.getElementById("home-question-status");

        if (!list || !status) {
            return;
        }

        const config = window.QUESTIONS_CONFIG || {};
        const url = (config.supabaseUrl || "").trim();
        const publicKey = (config.supabasePublishableKey || config.supabaseAnonKey || "").trim();
        const table = config.questionsTable || "questions_worth_asking";

        if (!window.supabase || !window.DOMPurify || !url || !publicKey) {
            status.textContent = "Connect Supabase to show live questions here.";
            return;
        }

        const client = window.supabase.createClient(url, publicKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        status.textContent = "Loading recent questions...";

        try {
            const { data, error } = await client
                .from(table)
                .select("created_at, display_name, publish_name, topic, question_text")
                .eq("status", "approved")
                .order("created_at", { ascending: false })
                .limit(3);

            if (error) {
                throw error;
            }

            list.innerHTML = "";
            const questions = Array.isArray(data) ? data : [];

            if (questions.length === 0) {
                status.textContent = "No public questions yet. Be the first to ask one.";
                return;
            }

            status.textContent = "";
            questions.forEach(function (item) {
                list.appendChild(buildQuestionItem(item));
            });
        } catch (error) {
            console.error(error);
            status.textContent = "Could not load recent questions right now.";
        }
    }

    function buildQuestionItem(item) {
        const li = document.createElement("li");
        li.className = "home-question-item";

        const topic = document.createElement("span");
        topic.className = "home-question-topic";
        topic.textContent = sanitizeInline(item.topic || "other");
        li.appendChild(topic);

        const text = document.createElement("p");
        text.className = "home-question-text";
        text.textContent = sanitizeQuestion(item.question_text || "");
        li.appendChild(text);

        const meta = document.createElement("p");
        meta.className = "home-question-meta";
        meta.textContent = "Asked by " + getAuthor(item) + " on " + formatDate(item.created_at);
        li.appendChild(meta);

        return li;
    }

    function getAuthor(item) {
        if (item.publish_name && item.display_name) {
            return sanitizeInline(item.display_name);
        }

        return "anonymous";
    }

    function sanitizeInline(value) {
        const clean = window.DOMPurify.sanitize(value || "", {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });

        return clean.replace(/\s+/g, " ").trim();
    }

    function sanitizeQuestion(value) {
        const clean = window.DOMPurify.sanitize(value || "", {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });

        return clean
            .replace(/\r\n/g, "\n")
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    function formatDate(value) {
        if (!value) {
            return "an unknown date";
        }

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric"
        }).format(new Date(value));
    }
})();
