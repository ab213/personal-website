(function () {
    const TOPICS = [
        "all",
        "purpose",
        "engineering",
        "books",
        "career",
        "focus",
        "health",
        "life",
        "other"
    ];

    const DISPLAY_NAMES = {
        all: "all",
        purpose: "purpose",
        engineering: "engineering",
        books: "books",
        career: "career",
        focus: "focus",
        health: "health",
        life: "life",
        other: "other"
    };

    const STORAGE_KEY = "questions-worth-asking-last-submit";

    let supabaseClient = null;
    let approvedQuestions = [];
    let activeTopic = "all";
    let cooldownTimer = null;

    const dom = {};

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        cacheDom();
        bindEvents();
        renderTopicFilters();
        renderQuestions();

        if (!initializeSupabase()) {
            setFeedStatus("Connect Supabase to load public questions.");
            disableSubmission("Setup required");
            dom.setupNotice.hidden = false;
            return;
        }

        dom.setupNotice.hidden = true;
        updateSubmitButton();
        startCooldownTicker();
        await loadApprovedQuestions();
    }

    function cacheDom() {
        dom.form = document.getElementById("question-form");
        dom.displayName = document.getElementById("display-name");
        dom.topic = document.getElementById("topic");
        dom.questionText = document.getElementById("question-text");
        dom.publishName = document.getElementById("publish-name");
        dom.honeypot = document.getElementById("company");
        dom.submitButton = document.getElementById("submit-button");
        dom.refreshButton = document.getElementById("refresh-button");
        dom.formStatus = document.getElementById("form-status");
        dom.feedStatus = document.getElementById("feed-status");
        dom.setupNotice = document.getElementById("setup-notice");
        dom.filterRow = document.getElementById("filter-row");
        dom.questionCount = document.getElementById("question-count");
        dom.questionList = document.getElementById("question-list");
    }

    function bindEvents() {
        dom.form.addEventListener("submit", handleSubmit);
        dom.refreshButton.addEventListener("click", loadApprovedQuestions);
    }

    function initializeSupabase() {
        const config = window.QUESTIONS_CONFIG || {};
        const url = (config.supabaseUrl || "").trim();
        const publicKey = (config.supabasePublishableKey || config.supabaseAnonKey || "").trim();

        if (!window.supabase || !window.DOMPurify || !url || !publicKey) {
            return false;
        }

        supabaseClient = window.supabase.createClient(url, publicKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        return true;
    }

    function renderTopicFilters() {
        dom.filterRow.innerHTML = "";

        TOPICS.forEach((topic) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "filter-chip" + (topic === activeTopic ? " active" : "");
            button.textContent = DISPLAY_NAMES[topic];
            button.addEventListener("click", function () {
                activeTopic = topic;
                renderTopicFilters();
                renderQuestions();
            });
            dom.filterRow.appendChild(button);
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!supabaseClient) {
            setFormStatus("Supabase is not connected yet.", "error");
            return;
        }

        const cooldownRemaining = getCooldownRemaining();
        if (cooldownRemaining > 0) {
            setFormStatus("Wait " + formatSeconds(cooldownRemaining) + " before sending another question.", "error");
            updateSubmitButton();
            return;
        }

        const payload = sanitizeFormPayload();
        const validationMessage = validatePayload(payload);

        if (validationMessage) {
            setFormStatus(validationMessage, "error");
            return;
        }

        if (dom.honeypot.value.trim() !== "") {
            dom.form.reset();
            setFormStatus("Question received. It should appear publicly right away.", "success");
            return;
        }

        setFormStatus("Sending your question...", "");
        setSubmitting(true);

        try {
            const { error } = await supabaseClient
                .from(getQuestionsTable())
                .insert(payload);

            if (error) {
                throw error;
            }

            localStorage.setItem(STORAGE_KEY, String(Date.now()));
            dom.form.reset();
            setFormStatus("Question received. It should appear publicly right away.", "success");
            updateSubmitButton();
        } catch (error) {
            console.error(error);
            setFormStatus("Submission failed. Check your Supabase setup and try again.", "error");
        } finally {
            setSubmitting(false);
        }
    }

    function sanitizeFormPayload() {
        return {
            display_name: sanitizeShortText(dom.displayName.value) || null,
            topic: sanitizeShortText(dom.topic.value).toLowerCase(),
            question_text: sanitizeQuestion(dom.questionText.value),
            publish_name: dom.publishName.checked
        };
    }

    function sanitizeShortText(value) {
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

    function validatePayload(payload) {
        if (!TOPICS.includes(payload.topic) || payload.topic === "all") {
            return "Choose a topic before submitting.";
        }

        if (!payload.question_text || payload.question_text.length < 20) {
            return "Write a question that is at least 20 characters.";
        }

        if (payload.question_text.length > 280) {
            return "Keep the question under 280 characters.";
        }

        if (payload.display_name && payload.display_name.length > 40) {
            return "Keep the name or alias under 40 characters.";
        }

        return "";
    }

    async function loadApprovedQuestions() {
        if (!supabaseClient) {
            return;
        }

        setFeedStatus("Loading public questions...");

        try {
            const { data, error } = await supabaseClient
                .from(getQuestionsTable())
                .select("id, created_at, display_name, publish_name, topic, question_text, response_url")
                .eq("status", "approved")
                .order("created_at", { ascending: false })
                .limit(24);

            if (error) {
                throw error;
            }

            approvedQuestions = Array.isArray(data) ? data : [];
            setFeedStatus("");
            renderQuestions();
        } catch (error) {
            console.error(error);
            approvedQuestions = [];
            setFeedStatus("Could not load public questions right now.");
            renderQuestions();
        }
    }

    function renderQuestions() {
        const questions = approvedQuestions.filter((item) => {
            return activeTopic === "all" || item.topic === activeTopic;
        });

        dom.questionList.innerHTML = "";
        dom.questionCount.textContent = questions.length + " public question" + (questions.length === 1 ? "" : "s");

        if (questions.length === 0) {
            const empty = document.createElement("li");
            empty.className = "empty-state";
            empty.textContent = activeTopic === "all"
                ? "No public questions yet. Be the first to send one."
                : "No public questions in this topic yet.";
            dom.questionList.appendChild(empty);
            return;
        }

        questions.forEach((item) => {
            dom.questionList.appendChild(buildQuestionCard(item));
        });
    }

    function buildQuestionCard(item) {
        const li = document.createElement("li");
        li.className = "question-item";

        const badge = document.createElement("span");
        badge.className = "topic-badge";
        badge.textContent = DISPLAY_NAMES[item.topic] || "other";
        li.appendChild(badge);

        const question = document.createElement("p");
        question.className = "question-text";
        question.textContent = sanitizeQuestion(item.question_text || "");
        li.appendChild(question);

        const meta = document.createElement("p");
        meta.className = "question-meta";
        meta.textContent = buildMetaText(item);
        li.appendChild(meta);

        const safeUrl = sanitizeUrl(item.response_url);
        if (safeUrl) {
            const answerLink = document.createElement("a");
            answerLink.className = "question-link";
            answerLink.href = safeUrl;
            answerLink.textContent = "Read the response";
            if (/^https?:\/\//i.test(safeUrl)) {
                answerLink.target = "_blank";
                answerLink.rel = "noreferrer";
            }
            li.appendChild(answerLink);
        }

        return li;
    }

    function buildMetaText(item) {
        const author = item.publish_name && item.display_name
            ? item.display_name
            : "anonymous";
        return "Asked by " + author + " on " + formatDate(item.created_at) + ".";
    }

    function formatDate(value) {
        if (!value) {
            return "an unknown date";
        }

        const date = new Date(value);
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(date);
    }

    function sanitizeUrl(value) {
        if (!value) {
            return "";
        }

        const clean = sanitizeShortText(value);
        if (/^(https?:\/\/|\/)/i.test(clean)) {
            return clean;
        }

        return "";
    }

    function getQuestionsTable() {
        const config = window.QUESTIONS_CONFIG || {};
        return config.questionsTable || "questions_worth_asking";
    }

    function disableSubmission(label) {
        dom.submitButton.disabled = true;
        dom.submitButton.textContent = label;
    }

    function setSubmitting(isSubmitting) {
        if (isSubmitting) {
            dom.submitButton.disabled = true;
            dom.submitButton.textContent = "Sending...";
            return;
        }

        updateSubmitButton();
    }

    function setFormStatus(message, type) {
        dom.formStatus.textContent = message;
        dom.formStatus.className = "status" + (type ? " " + type : "");
    }

    function setFeedStatus(message) {
        dom.feedStatus.textContent = message;
        dom.feedStatus.className = "status" + (message ? "" : "");
    }

    function getCooldownRemaining() {
        const config = window.QUESTIONS_CONFIG || {};
        const cooldownMs = Number(config.submissionCooldownMs) || 60000;
        const lastSubmittedAt = Number(localStorage.getItem(STORAGE_KEY) || 0);

        if (!lastSubmittedAt) {
            return 0;
        }

        const remaining = cooldownMs - (Date.now() - lastSubmittedAt);
        return remaining > 0 ? remaining : 0;
    }

    function updateSubmitButton() {
        if (!supabaseClient) {
            disableSubmission("Setup required");
            return;
        }

        const remaining = getCooldownRemaining();
        if (remaining > 0) {
            dom.submitButton.disabled = true;
            dom.submitButton.textContent = "Try again in " + formatSeconds(remaining);
            return;
        }

        dom.submitButton.disabled = false;
        dom.submitButton.textContent = "Send question";
    }

    function formatSeconds(ms) {
        return Math.ceil(ms / 1000) + "s";
    }

    function startCooldownTicker() {
        if (cooldownTimer) {
            clearInterval(cooldownTimer);
        }

        cooldownTimer = window.setInterval(updateSubmitButton, 1000);
    }
})();
