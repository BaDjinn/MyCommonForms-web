const SESSION_COOKIE = "github_auth_session";
const STATE_COOKIE = "github_auth_state";

const LOGIN_PATH = "/__auth/login";
const CALLBACK_PATH = "/__auth/callback";
const LOGOUT_PATH = "/__auth/logout";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

export default async function githubAuth(request, context) {
	const url = new URL(request.url);

	const config = readConfig();

	if (!config.ok) {
		return htmlResponse(
			503,
			renderPage({
				title: "Auth non configurata",
				body: `
          <main class="box">
            <h1>Auth non configurata</h1>
            <p>Mancano una o più variabili ambiente richieste.</p>
            <pre>${escapeHtml(config.error)}</pre>
          </main>
        `,
			}),
		);
	}

	if (url.pathname === LOGIN_PATH) {
		if (url.searchParams.get("start") === "github") {
			return startGithubLogin(request, config);
		}

		return loginPage(url);
	}

	if (url.pathname === CALLBACK_PATH) {
		return handleGithubCallback(request, config);
	}

	if (url.pathname === LOGOUT_PATH) {
		return logout(request);
	}

	const session = await readSession(request, config.authSecret);

	if (!session || !session.u) {
		return redirectToLogin(url);
	}

	const login = String(session.u).toLowerCase();

	if (!config.allowedLogins.has(login)) {
		return forbiddenPage("Utente non più autorizzato.");
	}

	const response = await context.next();

	return addSecurityHeaders(response);
}

function readConfig() {
	const githubClientId = getEnv("GITHUB_CLIENT_ID");
	const githubClientSecret = getEnv("GITHUB_CLIENT_SECRET");
	const authSecret = getEnv("AUTH_SECRET");
	const allowedRaw = getEnv("AUTH_ALLOWED_LOGINS");
	const sessionHoursRaw = getEnv("AUTH_SESSION_HOURS") || "24";

	const missing = [];

	if (!githubClientId) missing.push("GITHUB_CLIENT_ID");
	if (!githubClientSecret) missing.push("GITHUB_CLIENT_SECRET");
	if (!authSecret) missing.push("AUTH_SECRET");
	if (!allowedRaw) missing.push("AUTH_ALLOWED_LOGINS");

	if (missing.length > 0) {
		return {
			ok: false,
			error: `Variabili mancanti: ${missing.join(", ")}`,
		};
	}

	const allowedLogins = new Set(
		allowedRaw
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean),
	);

	if (allowedLogins.size === 0) {
		return {
			ok: false,
			error: "AUTH_ALLOWED_LOGINS non contiene utenti validi.",
		};
	}

	const sessionHours = Math.max(1, Number(sessionHoursRaw) || 24);

	return {
		ok: true,
		githubClientId,
		githubClientSecret,
		authSecret,
		allowedLogins,
		sessionSeconds: sessionHours * 60 * 60,
	};
}

function getEnv(name) {
	try {
		return Netlify.env.get(name) || "";
	} catch {
		return "";
	}
}

async function startGithubLogin(request, config) {
	const url = new URL(request.url);
	const next = safeNext(url.searchParams.get("next") || "/");

	const callbackUrl = `${url.origin}${CALLBACK_PATH}`;

	const statePayload = {
		r: randomToken(),
		n: next,
		exp: nowSeconds() + 10 * 60,
	};

	const state = await signPayload(statePayload, config.authSecret);

	const githubUrl = new URL(GITHUB_AUTHORIZE_URL);

	githubUrl.searchParams.set("client_id", config.githubClientId);
	githubUrl.searchParams.set("redirect_uri", callbackUrl);
	githubUrl.searchParams.set("scope", "read:user");
	githubUrl.searchParams.set("state", state);

	const headers = new Headers();

	headers.set("Location", githubUrl.toString());
	headers.append(
		"Set-Cookie",
		makeCookie(request, STATE_COOKIE, state, {
			maxAge: 10 * 60,
			httpOnly: true,
			sameSite: "Lax",
			path: "/",
		}),
	);

	return new Response(null, {
		status: 303,
		headers,
	});
}

async function handleGithubCallback(request, config) {
	const url = new URL(request.url);

	const code = url.searchParams.get("code") || "";
	const state = url.searchParams.get("state") || "";
	const stateCookie = getCookie(request, STATE_COOKIE);

	if (!code || !state || !stateCookie || state !== stateCookie) {
		return badRequestPage("Callback OAuth non valido. Riprova il login.");
	}

	const statePayload = await verifySignedPayload(state, config.authSecret);

	if (!statePayload || !statePayload.exp || statePayload.exp < nowSeconds()) {
		return badRequestPage("Sessione OAuth scaduta. Riprova il login.");
	}

	const callbackUrl = `${url.origin}${CALLBACK_PATH}`;

	const tokenResult = await exchangeCodeForToken({
		code,
		callbackUrl,
		clientId: config.githubClientId,
		clientSecret: config.githubClientSecret,
	});

	if (!tokenResult.ok) {
		return badRequestPage(
			`Errore durante lo scambio token: ${tokenResult.error}`,
		);
	}

	const userResult = await fetchGithubUser(tokenResult.accessToken);

	if (!userResult.ok) {
		return badRequestPage(
			`Errore durante la lettura utente GitHub: ${userResult.error}`,
		);
	}

	const githubLogin = String(userResult.user.login || "").trim();
	const normalizedLogin = githubLogin.toLowerCase();

	if (!config.allowedLogins.has(normalizedLogin)) {
		return forbiddenPage(`Utente GitHub non autorizzato: ${githubLogin}`);
	}

	const sessionPayload = {
		u: githubLogin,
		exp: nowSeconds() + config.sessionSeconds,
	};

	const sessionToken = await signPayload(sessionPayload, config.authSecret);

	const next = safeNext(statePayload.n || "/");

	const headers = new Headers();

	headers.set("Location", next);
	headers.append(
		"Set-Cookie",
		makeCookie(request, SESSION_COOKIE, sessionToken, {
			maxAge: config.sessionSeconds,
			httpOnly: true,
			sameSite: "Lax",
			path: "/",
		}),
	);
	headers.append("Set-Cookie", clearCookie(request, STATE_COOKIE));

	return new Response(null, {
		status: 303,
		headers,
	});
}

async function exchangeCodeForToken({
	code,
	callbackUrl,
	clientId,
	clientSecret,
}) {
	const body = new URLSearchParams();

	body.set("client_id", clientId);
	body.set("client_secret", clientSecret);
	body.set("code", code);
	body.set("redirect_uri", callbackUrl);

	let response;

	try {
		response = await fetch(GITHUB_TOKEN_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "netlify-github-auth-gate",
			},
			body,
		});
	} catch (error) {
		return {
			ok: false,
			error: String(error?.message || error),
		};
	}

	let data;

	try {
		data = await response.json();
	} catch {
		return {
			ok: false,
			error: "Risposta token non JSON.",
		};
	}

	if (!response.ok || data.error) {
		return {
			ok: false,
			error:
				data.error_description ||
				data.error ||
				`HTTP ${response.status}`,
		};
	}

	if (!data.access_token) {
		return {
			ok: false,
			error: "access_token assente nella risposta GitHub.",
		};
	}

	return {
		ok: true,
		accessToken: data.access_token,
	};
}

async function fetchGithubUser(accessToken) {
	let response;

	try {
		response = await fetch(GITHUB_USER_URL, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "netlify-github-auth-gate",
			},
		});
	} catch (error) {
		return {
			ok: false,
			error: String(error?.message || error),
		};
	}

	let data;

	try {
		data = await response.json();
	} catch {
		return {
			ok: false,
			error: "Risposta utente non JSON.",
		};
	}

	if (!response.ok) {
		return {
			ok: false,
			error: data.message || `HTTP ${response.status}`,
		};
	}

	if (!data.login) {
		return {
			ok: false,
			error: "Campo login assente nella risposta GitHub.",
		};
	}

	return {
		ok: true,
		user: data,
	};
}

async function readSession(request, authSecret) {
	const token = getCookie(request, SESSION_COOKIE);

	if (!token) return null;

	const payload = await verifySignedPayload(token, authSecret);

	if (!payload) return null;

	if (!payload.exp || payload.exp < nowSeconds()) {
		return null;
	}

	return payload;
}

function redirectToLogin(url) {
	const next = safeNext(`${url.pathname}${url.search}`);
	const loginUrl = new URL(LOGIN_PATH, url.origin);

	loginUrl.searchParams.set("next", next);

	return new Response(null, {
		status: 303,
		headers: {
			Location: loginUrl.toString(),
			"Cache-Control": "private, no-store",
			"X-Robots-Tag":
				"noindex, nofollow, noarchive, nosnippet, noimageindex",
		},
	});
}

function loginPage(url) {
	const next = safeNext(url.searchParams.get("next") || "/");
	const startUrl = new URL(LOGIN_PATH, url.origin);

	startUrl.searchParams.set("start", "github");
	startUrl.searchParams.set("next", next);

	return htmlResponse(
		200,
		renderPage({
			title: "LocalForm — Accesso",
			body: `
        <main class="box login-box">
          <div class="brand">
            <span class="mark">F</span>
            <span>LocalForm</span>
          </div>

          <h1>PDF form detection,<br>in locale.</h1>

          <p class="lead">
            Accedi per usare lo strumento. I PDF vengono elaborati
            nel browser e non sono inviati a un server.
          </p>

          <a class="primary" href="${escapeHtml(startUrl.toString())}">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.2c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.99 10.99 0 0 1 12 6.13c.98 0 1.95.13 2.86.38 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.21c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
              />
            </svg>

            Continue with GitHub
          </a>

          <p class="note">
            Accesso consentito esclusivamente agli account autorizzati.
          </p>
        </main>
      `,
		}),
	);
}

function logout(request) {
	const headers = new Headers();

	headers.set("Location", "/");
	headers.append("Set-Cookie", clearCookie(request, SESSION_COOKIE));
	headers.append("Set-Cookie", clearCookie(request, STATE_COOKIE));

	return new Response(null, {
		status: 303,
		headers,
	});
}

function forbiddenPage(message) {
	return htmlResponse(
		403,
		renderPage({
			title: "Accesso negato",
			body: `
        <main class="box">
          <h1>Accesso negato</h1>
          <p>${escapeHtml(message)}</p>
          <p><a href="${LOGOUT_PATH}">Esci</a></p>
        </main>
      `,
		}),
	);
}

function badRequestPage(message) {
	return htmlResponse(
		400,
		renderPage({
			title: "Richiesta non valida",
			body: `
        <main class="box">
          <h1>Richiesta non valida</h1>
          <p>${escapeHtml(message)}</p>
          <p><a href="${LOGIN_PATH}">Riprova login</a></p>
        </main>
      `,
		}),
	);
}

function addSecurityHeaders(response) {
	const headers = new Headers(response.headers);

	headers.set(
		"X-Robots-Tag",
		"noindex, nofollow, noarchive, nosnippet, noimageindex",
	);
	headers.set("Referrer-Policy", "no-referrer");
	headers.set("Cache-Control", "private, no-store");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function htmlResponse(status, body) {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Robots-Tag":
				"noindex, nofollow, noarchive, nosnippet, noimageindex",
			"Referrer-Policy": "no-referrer",
		},
	});
}

function renderPage({ title, body }) {
	return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta
    name="robots"
    content="noindex,nofollow,noarchive,nosnippet,noimageindex"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>

  <style>
    :root {
      color-scheme: dark;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      background: #101010;
      color: #eeeeee;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background:
        radial-gradient(
          circle at top,
          #242424 0,
          #101010 48%,
          #050505 100%
        );
    }

    .box {
      width: min(440px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 28px;
      border: 1px solid #333333;
      border-radius: 18px;
      background: rgba(18, 18, 18, 0.94);
      box-shadow: 0 24px 90px rgba(0, 0, 0, 0.5);
    }

    .login-box {
      padding: 34px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 38px;
      color: #f8fafc;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .mark {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border-radius: 9px;
      background: #6366f1;
      color: white;
      font-size: 1rem;
    }

    h1 {
      margin: 0 0 16px;
      font-size: clamp(1.8rem, 7vw, 2.35rem);
      line-height: 1.08;
      letter-spacing: -0.035em;
    }

    p {
      line-height: 1.5;
    }

    a {
      color: #ffffff;
      font-weight: 700;
    }

    .lead {
      margin: 0 0 26px;
      color: #94a3b8;
    }

    .primary {
      display: flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-sizing: border-box;
      border: 1px solid #6366f1;
      border-radius: 10px;
      background: #4f46e5;
      text-decoration: none;
      transition:
        background 150ms ease,
        border-color 150ms ease;
    }

    .primary:hover {
      border-color: #818cf8;
      background: #6366f1;
    }

    .primary svg {
      width: 20px;
      height: 20px;
    }

    .note {
      margin: 18px 0 0;
      color: #64748b;
      font-size: 0.78rem;
      text-align: center;
    }

    pre {
      white-space: pre-wrap;
      padding: 12px;
      border: 1px solid #333333;
      border-radius: 10px;
      background: #050505;
      color: #dddddd;
      overflow: auto;
    }
  </style>
</head>

<body>
  ${body}
</body>
</html>`;
}

async function signPayload(payload, secret) {
	const body = base64urlEncode(
		new TextEncoder().encode(JSON.stringify(payload)),
	);

	const signature = await hmacSign(body, secret);

	return `${body}.${signature}`;
}

async function verifySignedPayload(token, secret) {
	const parts = String(token).split(".");

	if (parts.length !== 2) return null;

	const [body, signature] = parts;

	if (!body || !signature) return null;

	const valid = await hmacVerify(body, signature, secret);

	if (!valid) return null;

	try {
		const decoded = base64urlDecode(body);
		const json = new TextDecoder().decode(decoded);

		return JSON.parse(json);
	} catch {
		return null;
	}
}

async function hmacSign(data, secret) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{
			name: "HMAC",
			hash: "SHA-256",
		},
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(data),
	);

	return base64urlEncode(new Uint8Array(signature));
}

async function hmacVerify(data, signatureB64, secret) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{
			name: "HMAC",
			hash: "SHA-256",
		},
		false,
		["verify"],
	);

	try {
		return await crypto.subtle.verify(
			"HMAC",
			key,
			base64urlDecode(signatureB64),
			new TextEncoder().encode(data),
		);
	} catch {
		return false;
	}
}

function getCookie(request, name) {
	const cookieHeader = request.headers.get("Cookie") || "";

	for (const part of cookieHeader.split(";")) {
		const [rawName, ...rawValue] = part.trim().split("=");

		if (rawName === name) {
			return decodeURIComponent(rawValue.join("="));
		}
	}

	return "";
}

function makeCookie(request, name, value, options = {}) {
	const url = new URL(request.url);
	const secure = url.protocol === "https:";

	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		`Path=${options.path || "/"}`,
	];

	if (options.maxAge !== undefined) {
		parts.push(`Max-Age=${Math.max(0, Number(options.maxAge) || 0)}`);
	}

	if (options.httpOnly) {
		parts.push("HttpOnly");
	}

	if (secure) {
		parts.push("Secure");
	}

	parts.push(`SameSite=${options.sameSite || "Lax"}`);

	return parts.join("; ");
}

function clearCookie(request, name) {
	return makeCookie(request, name, "", {
		maxAge: 0,
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
	});
}

function safeNext(value) {
	const raw = String(value || "/").trim();

	if (!raw.startsWith("/")) return "/";
	if (raw.startsWith("//")) return "/";
	if (raw.startsWith(LOGIN_PATH)) return "/";
	if (raw.startsWith(CALLBACK_PATH)) return "/";
	if (raw.startsWith(LOGOUT_PATH)) return "/";

	return raw;
}

function randomToken() {
	const bytes = new Uint8Array(24);

	crypto.getRandomValues(bytes);

	return base64urlEncode(bytes);
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function base64urlEncode(bytes) {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64urlDecode(value) {
	const text = String(value || "")
		.replaceAll("-", "+")
		.replaceAll("_", "/");

	const padded = text.padEnd(Math.ceil(text.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}