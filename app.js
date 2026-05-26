(function () {
  "use strict";

  console.log("[HelpOn] app.js carregado - build cadastro debug 2026-05");

  angular
    .module("helpOnApp", ["ngRoute", "ngSanitize", "ngAnimate"])
    .config(configureRoutes)
    .config(configureHttp)
    .run(authRunGuard)
    .factory("SupabaseService", SupabaseService)
    .service("AuthService", AuthService)
    .service("ProfileService", ProfileService)
    .service("TicketService", TicketService)
    .service("NotificationService", NotificationService)
    .service("QueueService", QueueService)
    .service("CommentService", CommentService)
    .service("AutomationService", AutomationService)
    .service("KPIService", KPIService)
    .controller("MainController", MainController)
    .directive("uppercaseOnly", uppercaseOnlyDirective)
    .directive("restrictPattern", restrictPatternDirective)
    .directive("profileDirective", profileDirective)
    .directive("slaBadge", slaBadgeDirective);

  configureRoutes.$inject = ["$routeProvider"];
  function configureRoutes($routeProvider) {
    $routeProvider
      .when("/dashboard", { templateUrl: "dashboard.html" })
      .when("/tickets", { templateUrl: "tickets.html" })
      .when("/archived", { templateUrl: "archived.html" })
      .when("/complete-profile", { templateUrl: "complete-profile.html" })
      .otherwise({ redirectTo: "/dashboard" });
  }

  configureHttp.$inject = ["$httpProvider"];
  function configureHttp($httpProvider) {
    $httpProvider.interceptors.push(["$q", "$injector", function ($q, $injector) {
      return {
        request: function (config) {
          var AuthService = $injector.get("AuthService");
          if (!AuthService.hasValidJwt()) {
            var $location = $injector.get("$location");
            var path = $location.path() || "";
            if (path !== "/") {
              $location.path("/");
            }
          }
          return config;
        },
        responseError: function (rejection) {
          return $q.reject(rejection);
        }
      };
    }]);
  }

  authRunGuard.$inject = ["$rootScope", "$location", "AuthService", "ProfileService"];
  function authRunGuard($rootScope, $location, AuthService, ProfileService) {
    $rootScope.$on("$routeChangeStart", function (event, next) {
      var target = (next && next.$$route && next.$$route.originalPath) || "";
      var publicPath = target === "";
      if (publicPath) {
        return;
      }
      if (!AuthService.hasValidJwt()) {
        event.preventDefault();
        $location.path("/");
        return;
      }
      if (target !== "/complete-profile" && !ProfileService.isProfileComplete()) {
        event.preventDefault();
        $location.path("/complete-profile");
        return;
      }
    });
  }

  SupabaseService.$inject = ["$q"];
  function SupabaseService($q) {
    var SUPABASE_URL = "https://xuevhgvbrscyxwvklbke.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_pXGDbChVanUln742FRe5iA_a1fxM9Jj";
    var configError = null;

    function isValidSupabaseUrl(value) {
      return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(value || ""));
    }

    function isValidPublicKey(value) {
      var key = String(value || "");
      return key.length > 20 && key.indexOf("YOUR_SUPABASE") === -1;
    }

    function getSafeError(error) {
      return {
        name: error && error.name,
        message: error && error.message,
        status: error && error.status,
        code: error && error.code
      };
    }

    function testSupabaseConnectivity() {
      return fetch(SUPABASE_URL + "/auth/v1/settings", {
        headers: {
          apikey: SUPABASE_ANON_KEY
        }
      })
        .then(function (r) {
          console.log("[HelpOn][Supabase connectivity]", r.status, r.statusText);
          return r.text();
        })
        .then(function (text) {
          console.log("[HelpOn][Supabase connectivity body]", text.slice(0, 300));
          return text;
        })
        .catch(function (error) {
          console.error("[HelpOn][Supabase connectivity failed]", error);
          throw error;
        });
    }

    function assertConfigured() {
      if (configError) {
        return $q.reject(configError);
      }
      if (!isValidSupabaseUrl(SUPABASE_URL) || !isValidPublicKey(SUPABASE_ANON_KEY)) {
        return $q.reject(new Error("Configuracao do Supabase invalida: verifique SUPABASE_URL e SUPABASE_ANON_KEY."));
      }
      return $q.resolve();
    }

    function createClient() {
      if (!isValidSupabaseUrl(SUPABASE_URL) || !isValidPublicKey(SUPABASE_ANON_KEY)) {
        throw new Error("Configuracao do Supabase invalida: verifique SUPABASE_URL e SUPABASE_ANON_KEY.");
      }
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("Supabase JS nao foi carregado. Verifique o script CDN no index.html.");
      }
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }

    var client = null;
    try {
      client = createClient();
    } catch (error) {
      configError = error;
      console.error("[HelpOn][Supabase] Client init error:", getSafeError(error));
    }

    window.HelpOnDiagnostics = window.HelpOnDiagnostics || {};
    window.HelpOnDiagnostics.testSupabaseConnectivity = testSupabaseConnectivity;

    return {
      client: client,
      getSafeError: getSafeError,
      testSupabaseConnectivity: testSupabaseConnectivity,
      assertConfigured: assertConfigured
    };
  }

  function localizeErrorMessage(error) {
    var raw = (error && (error.message || error.error_description || error.msg)) || "Falha desconhecida.";
    var message = String(raw).toLowerCase();
    var status = Number(error && error.status);
    var code = String((error && (error.code || error.error_code)) || "").toLowerCase();
    var name = String((error && error.name) || "").toLowerCase();

    if (message.indexOf("supabase js nao foi carregado") !== -1) {
      return "Supabase JS nao foi carregado. Verifique o script CDN no index.html.";
    }
    if (message.indexOf("configuracao do supabase invalida") !== -1) {
      return "Configuracao do Supabase invalida: verifique SUPABASE_URL e SUPABASE_ANON_KEY.";
    }
    if (
      message.indexOf("colunas de arquivamento") !== -1 ||
      message.indexOf("is_archived") !== -1 ||
      message.indexOf("archived_at") !== -1 ||
      message.indexOf("archived_by") !== -1
    ) {
      return "A migration de arquivamento ainda não foi executada no Supabase.";
    }
    if (message.indexOf("nenhum chamado fechado foi encontrado para arquivar") !== -1) {
      return "Nenhum chamado fechado foi encontrado para arquivar. Verifique se o status ainda é Fechado.";
    }
    if (
      message.indexOf("row-level security") !== -1 ||
      message.indexOf("violates row-level security") !== -1 ||
      message.indexOf("permission denied") !== -1
    ) {
      return "O Supabase bloqueou o arquivamento por política de segurança. Verifique as policies de update em public.tickets.";
    }
    if (
      name === "typeerror" ||
      message.indexOf("failed to fetch") !== -1 ||
      message.indexOf("networkerror") !== -1 ||
      message.indexOf("load failed") !== -1 ||
      message.indexOf("network request failed") !== -1 ||
      message.indexOf("cors") !== -1
    ) {
      return "Nao foi possivel conectar ao Supabase. Verifique conexao, CORS, bloqueadores ou disponibilidade do projeto.";
    }
    if (
      code.indexOf("invalid_api_key") !== -1 ||
      message.indexOf("invalid api key") !== -1 ||
      message.indexOf("api key") !== -1 ||
      message.indexOf("project not found") !== -1 ||
      message.indexOf("supabase_url") !== -1 ||
      message.indexOf("supabase_anon_key") !== -1
    ) {
      return "Configuracao do Supabase invalida. Verifique URL e chave anonima do projeto.";
    }
    if (
      code.indexOf("validation_failed") !== -1 && message.indexOf("redirect") !== -1 ||
      message.indexOf("redirect") !== -1 ||
      (message.indexOf("not allowed") !== -1 && message.indexOf("url") !== -1) ||
      message.indexOf("site url") !== -1
    ) {
      return "Configuracao de redirecionamento do cadastro invalida. Verifique as URLs no Supabase.";
    }
    if (
      code.indexOf("signup_disabled") !== -1 ||
      (message.indexOf("signup") !== -1 && message.indexOf("disabled") !== -1) ||
      message.indexOf("signups not allowed") !== -1 ||
      message.indexOf("provider is not enabled") !== -1
    ) {
      return "Cadastro por e-mail desativado no Supabase.";
    }
    if (
      status === 429 ||
      code.indexOf("rate_limit") !== -1 ||
      message.indexOf("rate limit") !== -1 ||
      message.indexOf("too many") !== -1 ||
      message.indexOf("over_email_send_rate_limit") !== -1
    ) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    if (
      status >= 500 && message.indexOf("database") !== -1 ||
      message.indexOf("database error saving new user") !== -1 ||
      message.indexOf("error saving new user") !== -1
    ) {
      return "Erro ao criar perfil do usuario no Supabase. Verifique triggers, tabela profiles e migration SQL.";
    }
    if (message.indexOf("row-level security policy") !== -1) {
      return "Nao foi possivel salvar ou acessar o perfil. Verifique as policies RLS no Supabase.";
    }
    if (message.indexOf("invalid login credentials") !== -1) {
      return "E-mail ou senha inválidos.";
    }
    if (message.indexOf("email not confirmed") !== -1) {
      return "Conta criada. Faça login com seu e-mail e senha para acessar.";
    }
    if (
      message.indexOf("user already registered") !== -1 ||
      message.indexOf("already registered") !== -1 ||
      message.indexOf("already exists") !== -1
    ) {
      return "Este e-mail já está cadastrado.";
    }
    if (
      message.indexOf("password should be at least") !== -1 ||
      message.indexOf("weak password") !== -1 ||
      (message.indexOf("password") !== -1 && message.indexOf("characters") !== -1)
    ) {
      return "A senha deve ter pelo menos 6 caracteres.";
    }
    if (message.indexOf("network") !== -1 || message.indexOf("fetch") !== -1 || message.indexOf("cors") !== -1) {
      return "Nao foi possivel conectar ao Supabase. Verifique conexao, CORS, bloqueadores ou disponibilidade do projeto.";
    }
    if (message.indexOf("jwt") !== -1) {
      return "Sua sessão expirou. Faça login novamente.";
    }
    return "Nao foi possivel concluir a operacao. Veja o console para detalhes tecnicos.";
  }

  AuthService.$inject = ["$q", "SupabaseService", "$sanitize"];
  function AuthService($q, SupabaseService, $sanitize) {
    var client = SupabaseService.client;
    var LOCK_KEY = "helpon_auth_lock";
    var ATTEMPTS_KEY = "helpon_auth_attempts";
    var MAX_ATTEMPTS = 3;
    var LOCK_MS = 5 * 60 * 1000;

    function sanitizeText(input) {
      return $sanitize(String(input || "")).trim();
    }

    function normalizeDateInput(input) {
      if (!input) {
        return "";
      }
      if (input instanceof Date && !isNaN(input.getTime())) {
        return input.toISOString().slice(0, 10);
      }
      return sanitizeText(input).slice(0, 10);
    }

    function sanitizeCpf(input) {
      return sanitizeText(input).replace(/\D/g, "").slice(0, 11);
    }

    function normalizeGender(value) {
      var gender = sanitizeText(value);
      return gender === "Feminino" || gender === "Masculino" ? gender : "";
    }

    function buildProfileMetadata(profileData) {
      var source = profileData || {};
      var legalFirstName = sanitizeText(source.legal_first_name);
      var lastName = sanitizeText(source.last_name);
      var documentNumber = sanitizeCpf(source.document_number);
      return {
        legal_first_name: legalFirstName,
        last_name: lastName,
        full_name: sanitizeText((legalFirstName + " " + lastName).trim()),
        birth_date: normalizeDateInput(source.birth_date),
        document_number: documentNumber,
        document_country: sanitizeText(source.document_country),
        nationality: sanitizeText(source.nationality),
        gender: normalizeGender(source.gender),
        phone_number: sanitizeText(source.phone_number),
        country: sanitizeText(source.country),
        state: sanitizeText(source.state),
        city: sanitizeText(source.city),
        role: "user"
      };
    }

    function getLockUntil() {
      return Number(window.localStorage.getItem(LOCK_KEY) || 0);
    }

    function getAttempts() {
      return Number(window.localStorage.getItem(ATTEMPTS_KEY) || 0);
    }

    function isLocked() {
      return Date.now() < getLockUntil();
    }

    function registerFailure() {
      var attempts = getAttempts() + 1;
      window.localStorage.setItem(ATTEMPTS_KEY, String(attempts));
      if (attempts >= MAX_ATTEMPTS) {
        window.localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
        window.localStorage.setItem(ATTEMPTS_KEY, "0");
      }
    }

    function clearFailures() {
      window.localStorage.setItem(ATTEMPTS_KEY, "0");
      window.localStorage.setItem(LOCK_KEY, "0");
    }

    function hasValidJwt() {
      try {
        if (!client || !client.supabaseUrl) { return false; }
        var raw = window.localStorage.getItem("sb-" + client.supabaseUrl.split("//")[1].split(".")[0] + "-auth-token");
        if (!raw) { return false; }
        var parsed = JSON.parse(raw);
        var token = parsed && parsed.access_token;
        if (!token) { return false; }
        var payload = JSON.parse(window.atob(token.split(".")[1]));
        return payload.exp * 1000 > Date.now();
      } catch (error) {
        return false;
      }
    }

    return {
      getSession: function () {
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(client.auth.getSession()).then(function (res) { return res.data.session; });
        });
      },
      signIn: function (email, password) {
        if (isLocked()) {
          return $q.reject(new Error("Bloqueio temporario por tentativas excessivas."));
        }
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(client.auth.signInWithPassword({
            email: sanitizeText(email),
            password: sanitizeText(password)
          })).then(function (res) {
            if (res.error) {
              registerFailure();
            } else {
              clearFailures();
            }
            return res;
          });
        });
      },
      signUp: function (email, password, profileData) {
        return SupabaseService.assertConfigured().then(function () {
          var options = {};
          if (profileData) {
            options.data = buildProfileMetadata(profileData);
          }
          console.log("[HelpOn][signUp] Calling Supabase Auth signup", {
            hasClient: !!client,
            hasSupabase: !!window.supabase
          });
          return $q.when(client.auth.signUp({
            email: sanitizeText(email),
            password: sanitizeText(password),
            options: options
          })).then(function (res) {
            if (res && res.error) {
              console.error("[HelpOn][signUp] Auth response error:", SupabaseService.getSafeError(res.error));
              throw res.error;
            }
            return res;
          }).catch(function (error) {
            console.error("[HelpOn][signUp] Supabase error:", SupabaseService.getSafeError(error));
            throw error;
          });
        });
      },
      signOut: function () {
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(client.auth.signOut()).then(function (res) {
            clearFailures();
            return res;
          });
        });
      },
      hasValidJwt: hasValidJwt,
      isLocked: isLocked,
      getRemainingLockSeconds: function () {
        return Math.max(0, Math.ceil((getLockUntil() - Date.now()) / 1000));
      },
      sanitizeText: sanitizeText
    };
  }

  ProfileService.$inject = ["$q", "SupabaseService", "AuthService"];
  function ProfileService($q, SupabaseService, AuthService) {
    var client = SupabaseService.client;
    var PROFILE_KEY = "helpon_profile_complete";

    function normalizeDateInput(input) {
      if (!input) {
        return "";
      }
      if (input instanceof Date && !isNaN(input.getTime())) {
        return input.toISOString().slice(0, 10);
      }
      return AuthService.sanitizeText(input).slice(0, 10);
    }

    function isFutureDate(value) {
      var date = new Date(value);
      if (isNaN(date.getTime())) {
        return false;
      }
      date.setHours(0, 0, 0, 0);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return date.getTime() > today.getTime();
    }

    function normalizeRole(value) {
      var role = AuthService.sanitizeText(value || "user");
      return role === "admin" || role === "agent" || role === "user" ? role : "user";
    }

    function normalizeGender(value) {
      var gender = AuthService.sanitizeText(value);
      return gender === "Masculino" || gender === "Feminino" ? gender : "";
    }

    function mapProfile(payload, userId) {
      payload = payload || {};
      var legalFirstName = AuthService.sanitizeText(payload.legal_first_name);
      var lastName = AuthService.sanitizeText(payload.last_name);
      var fullName = AuthService.sanitizeText((legalFirstName + " " + lastName).trim());
      var documentNumber = AuthService.sanitizeText(payload.document_number).replace(/\D/g, "").slice(0, 11);
      return {
        id: userId,
        legal_first_name: legalFirstName,
        last_name: lastName,
        full_name: fullName,
        birth_date: normalizeDateInput(payload.birth_date),
        document_number: documentNumber,
        document_country: AuthService.sanitizeText(payload.document_country),
        nationality: AuthService.sanitizeText(payload.nationality),
        gender: normalizeGender(payload.gender),
        phone_number: AuthService.sanitizeText(payload.phone_number),
        country: AuthService.sanitizeText(payload.country),
        state: AuthService.sanitizeText(payload.state),
        city: AuthService.sanitizeText(payload.city),
        role: normalizeRole(payload.role)
      };
    }

    function isComplete(profile) {
      return Boolean(
        profile &&
        profile.legal_first_name &&
        profile.last_name &&
        profile.birth_date &&
        !isFutureDate(profile.birth_date) &&
        /^\d{11}$/.test(AuthService.sanitizeText(profile.document_number).replace(/\D/g, "")) &&
        profile.document_country &&
        profile.nationality &&
        normalizeGender(profile.gender) &&
        profile.phone_number &&
        profile.country &&
        profile.state &&
        profile.city
      );
    }

    return {
      fetchProfile: function (userId) {
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(client.from("profiles").select("*").eq("id", userId).maybeSingle()).then(function (res) {
            if (res.error) { throw res.error; }
            window.localStorage.setItem(PROFILE_KEY, String(isComplete(res.data)));
            return res.data;
          });
        });
      },
      upsertProfile: function (payload, userId) {
        var row = mapProfile(payload, userId);
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(client.from("profiles").upsert(row).select("*").single()).then(function (res) {
            if (res.error) { throw res.error; }
            window.localStorage.setItem(PROFILE_KEY, String(isComplete(res.data)));
            return res.data;
          });
        });
      },
      isProfileComplete: function () {
        return window.localStorage.getItem(PROFILE_KEY) === "true";
      }
    };
  }

  TicketService.$inject = ["$q", "SupabaseService"];
  function TicketService($q, SupabaseService) {
    var client = SupabaseService.client;
    var profileNameCache = {};
    var hasTicketsLocationColumn = null;
    var hasTicketsProblemDetailsColumn = null;
    var hasTicketsContactEmailColumn = null;
    var hasTicketsArchiveColumns = null;
    var requesterProfileSelect = "id,full_name,legal_first_name,last_name,document_number,document_country,nationality,gender,phone_number,country,state,city,role";

    var priorityMatrix = {
      Crítico: { Crítica: "Urgente", Alta: "Urgente", Média: "Alta", Baixa: "Alta" },
      Alto: { Crítica: "Urgente", Alta: "Alta", Média: "Alta", Baixa: "Média" },
      Médio: { Crítica: "Alta", Alta: "Média", Média: "Média", Baixa: "Baixa" },
      Baixo: { Crítica: "Média", Alta: "Média", Média: "Baixa", Baixa: "Baixa" }
    };

    var fixedPriorityByCategory = {
      "achados e perdidos": "Baixa",
      "reembolso e compensacao": "Baixa",
      "reembolsos e compensacao": "Baixa",
      "bagagem": "Média",
      "check-in/embarque": "Alta",
      "assistencia especial": "Alta",
      "alteracao/cancelamento de voo": "Urgente"
    };

    var priorityInputsByLevel = {
      Baixa: { impact: "Baixo", urgency: "Baixa" },
      Média: { impact: "Médio", urgency: "Alta" },
      Alta: { impact: "Alto", urgency: "Média" },
      Urgente: { impact: "Crítico", urgency: "Crítica" }
    };

    var slaByPriority = { Urgente: 60, Alta: 180, Média: 480, Baixa: 1440 };
    var statusFlow = ["Aberto", "Pendente", "Em Andamento", "Em Espera", "Resolvido", "Fechado"];

    function normalizeCategoryKey(value) {
      var text = String(value || "").toLowerCase().trim();

      if (typeof text.normalize === "function") {
        text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }

      return text
        .replace(/[–—]/g, "-")
        .replace(/\s*\/\s*/g, "/")
        .replace(/\s+/g, " ");
    }

    function priorityForCategory(category) {
      return fixedPriorityByCategory[normalizeCategoryKey(category)] || null;
    }

    function priorityInputsForCategory(category) {
      var priority = priorityForCategory(category) || "Média";
      var inputs = priorityInputsByLevel[priority] || priorityInputsByLevel["Média"];

      return {
        priority: priority,
        impact: inputs.impact,
        urgency: inputs.urgency
      };
    }

    function classifyPriority(impact, urgency, category) {
      return priorityForCategory(category) ||
        (priorityMatrix[impact] && priorityMatrix[impact][urgency]) ||
        "Média";
    }
    function slaMinutesFor(priority) {
      return slaByPriority[priority] || 480;
    }

    function getSlaDeadline(priority) {
      var minutes = slaMinutesFor(priority);
      return new Date(Date.now() + minutes * 60000).toISOString();
    }

    function isOnHoldStatus(status) {
      return status === "On Hold" || status === "Em Espera";
    }

    function isClosedStatus(status) {
      return status === "Fechado";
    }

    function safeMs(value) {
      var n = Number(value);
      return isFinite(n) && n > 0 ? n : 0;
    }

    function safeDateMs(value) {
      if (!value) {
        return null;
      }
      var ms = new Date(value).getTime();
      return isFinite(ms) && ms > 0 ? ms : null;
    }

    function getSlaStopMs(ticket, nowDate) {
      return safeDateMs(ticket.resolved_at) ||
        safeDateMs(ticket.updated_at) ||
        nowDate.getTime();
    }

    function getRemainingSLA(ticket, now) {
      if (!ticket || !ticket.sla_deadline) {
        return null;
      }

      var nowDate = now instanceof Date ? now : new Date(now || Date.now());
      var deadlineMs = new Date(ticket.sla_deadline).getTime();
      if (!isFinite(deadlineMs)) {
        return null;
      }

      var adjustedDeadlineMs = deadlineMs + safeMs(ticket.total_paused_ms);
      var paused = isOnHoldStatus(ticket.status) && !!ticket.last_paused_at;
      var remainingMs;

      if (isClosedStatus(ticket.status)) {
        remainingMs = adjustedDeadlineMs - getSlaStopMs(ticket, nowDate);
        paused = false;
      } else if (paused) {
        var lastPausedMs = new Date(ticket.last_paused_at).getTime();
        if (isFinite(lastPausedMs)) {
          remainingMs = adjustedDeadlineMs - lastPausedMs;
        } else {
          paused = false;
          remainingMs = adjustedDeadlineMs - nowDate.getTime();
        }
      } else {
        remainingMs = adjustedDeadlineMs - nowDate.getTime();
      }

      var remainingMinutes = Math.round(remainingMs / 60000);
      var absolute = Math.abs(remainingMinutes);
      var hours = Math.floor(absolute / 60);
      var minutes = absolute % 60;

      var label = (remainingMinutes < 0 ? "-" : "") + hours + "h " + minutes + "m";
      if (paused) {
        label = "⏸ " + label;
      } else if (isClosedStatus(ticket.status)) {
        label = "Fechado • " + label;
      }

      var state;
      if (isClosedStatus(ticket.status)) {
        state = remainingMinutes < 0 ? "breached" : "closed";
      } else if (paused) {
        state = "paused";
      } else if (remainingMinutes < 0) {
        state = "breached";
      } else if (remainingMinutes <= 30) {
        state = "critical";
      } else if (remainingMinutes <= 60) {
        state = "warning";
      } else {
        state = "ok";
      }

      return {
        remainingMinutes: remainingMinutes,
        remainingLabel: label,
        slaState: state,
        paused: paused,
        closed: isClosedStatus(ticket.status)
      };
    }

    function getStats(filteredTickets, now) {
      var tickets = filteredTickets || [];
      var byStatus = {};
      var total = 0;
      var slaOk = 0;
      var slaBreached = 0;

      tickets.forEach(function (t) {
        if (!t) { return; }
        total += 1;

        var status = t.status || "Unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;

        var r = getRemainingSLA(t, now);
        if (!r) { return; }

        if (r.slaState === "breached") {
          slaBreached += 1;
          return;
        }

        // Extra Tip: paused counts as OK (time is stopped)
        slaOk += 1;
      });

      return {
        total: total,
        slaOk: slaOk,
        slaBreached: slaBreached,
        byStatus: byStatus
      };
    }

    function normalizeOptionalUuid(value) {
      if (value === undefined || value === null || value === "") {
        return null;
      }
      if (typeof value === "object" && value !== null && value.id) {
        return value.id;
      }
      return value;
    }

    function rememberProfileName(id, fullName) {
      if (!id || !fullName) {
        return;
      }
      profileNameCache[String(id)] = String(fullName);
    }

    function resolveProfileName(id) {
      if (!id) {
        return null;
      }
      return profileNameCache[String(id)] || null;
    }

    function looksLikeUuid(value) {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
    }

    function decorateTicketRow(row) {
      if (!row) {
        return row;
      }
      row.category_name = row.categories ? row.categories.name : "Sem categoria";
      row.queue_name = row.queue ? row.queue.name : "No queue";
      var assigneeUuid = row.assigned_to;
      var embed = row.assignee;
      var requesterEmbed = row.requester || row.requester_profile || null;
      delete row.assignee;
      delete row.queue;
      delete row.requester;
      row.assigned_to = {
        id: assigneeUuid || null,
        full_name: embed && embed.full_name ? embed.full_name : null
      };
      row.requester_id = normalizeOptionalUuid(row.requester_id);
      row.requester_profile = normalizeRequesterProfile(requesterEmbed);
      if (row.assigned_to.id && row.assigned_to.full_name) {
        rememberProfileName(row.assigned_to.id, row.assigned_to.full_name);
      }
      return row;
    }

    function normalizeRequesterProfile(profile) {
      if (!profile) {
        return null;
      }
      return {
        id: profile.id || null,
        full_name: profile.full_name || null,
        legal_first_name: profile.legal_first_name || null,
        last_name: profile.last_name || null,
        document_number: profile.document_number || null,
        document_country: profile.document_country || null,
        nationality: profile.nationality || null,
        gender: profile.gender || null,
        phone_number: profile.phone_number || null,
        country: profile.country || null,
        state: profile.state || null,
        city: profile.city || null,
        role: profile.role || null
      };
    }

    function uniqueRequesterIds(tickets) {
      var seen = {};
      return (tickets || []).reduce(function (ids, ticket) {
        var id = ticket && ticket.requester_id ? String(ticket.requester_id) : "";
        if (id && !seen[id]) {
          seen[id] = true;
          ids.push(id);
        }
        return ids;
      }, []);
    }

    function fetchRequesterProfiles(requesterIds) {
      var ids = (requesterIds || []).filter(Boolean);
      if (!ids.length) {
        return $q.when({});
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("profiles")
            .select(requesterProfileSelect)
            .in("id", ids)
        ).then(function (res) {
          if (res.error) { throw res.error; }
          var map = {};
          (res.data || []).forEach(function (profile) {
            if (profile && profile.id) {
              map[profile.id] = normalizeRequesterProfile(profile);
            }
          });
          return map;
        });
      }).catch(function (error) {
        console.warn("[HelpOn] Nao foi possivel carregar perfis dos requerentes.", error);
        return {};
      });
    }

    function attachRequesterProfiles(tickets) {
      var rows = tickets || [];
      return fetchRequesterProfiles(uniqueRequesterIds(rows)).then(function (profilesById) {
        rows.forEach(function (ticket) {
          if (ticket && ticket.requester_id) {
            ticket.requester_profile = profilesById[ticket.requester_id] || ticket.requester_profile || null;
          }
        });
        return rows;
      });
    }

    function decorateHistoryRow(row) {
      if (!row) {
        return row;
      }
      var oldValue = row.old_value || {};
      var newValue = row.new_value || {};
      var oldLabel = "";
      var newLabel = "";
      var actionLabel = "Changed field";
      var actorName = "System";
      if (row.actor_id) {
        actorName = row.actor && row.actor.full_name ? row.actor.full_name : "User Removed";
      }

      if (row.action === "status_change") {
        actionLabel = "Changed status";
        oldLabel = oldValue.status || "Unknown";
        newLabel = newValue.status || "Unknown";
      } else if (row.action === "assignment_change") {
        actionLabel = "Changed assignment";
        var oldAssigned = oldValue.assigned_to ? String(oldValue.assigned_to) : "";
        var newAssigned = newValue.assigned_to ? String(newValue.assigned_to) : "";
        if (oldAssigned && looksLikeUuid(oldAssigned)) {
          oldLabel = resolveProfileName(oldAssigned) || oldAssigned;
        } else {
          oldLabel = oldAssigned ? oldAssigned : "Unassigned";
        }
        if (newAssigned && looksLikeUuid(newAssigned)) {
          newLabel = resolveProfileName(newAssigned) || newAssigned;
        } else {
          newLabel = newAssigned ? newAssigned : "Unassigned";
        }
      } else if (row.action === "priority_change") {
        actionLabel = "Changed priority";
        oldLabel = oldValue.priority || "Unknown";
        newLabel = newValue.priority || "Unknown";
      }

      row.actor_name = actorName;
      row.action_label = actionLabel;
      row.old_label = oldLabel;
      row.new_label = newLabel;
      row.summary = actorName + " " + actionLabel.toLowerCase() + " from \"" + oldLabel + "\" to \"" + newLabel + "\"";
      return row;
    }

    function fetchCategories() {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("categories").select("id,name").order("name")).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data || [];
        });
      });
    }

    function fetchTickets(options) {
      var includeRequesterProfiles = !!(options && options.includeRequesterProfiles);
      var includeArchived = !!(options && options.includeArchived);
      var onlyArchived = !!(options && options.onlyArchived);
      return detectTicketsArchiveColumns().then(function (supportsArchive) {
        if (onlyArchived && !supportsArchive) {
          return [];
        }
        return SupabaseService.assertConfigured().then(function () {
          var query = client
            .from("tickets")
            .select("*,categories(name),queue:queues(name),assignee:profiles!assigned_to(full_name)");
          if (supportsArchive && onlyArchived) {
            query = query.eq("is_archived", true).order("archived_at", { ascending: false, nullsFirst: false });
          } else if (supportsArchive && !includeArchived) {
            query = query.or("is_archived.is.false,is_archived.is.null").order("created_at", { ascending: false });
          } else {
            query = query.order("created_at", { ascending: false });
          }
          return $q.when(query).then(function (res) {
            if (res.error) { throw res.error; }
            var rows = (res.data || []).map(decorateTicketRow);
            if (!includeRequesterProfiles) {
              return rows;
            }
            return attachRequesterProfiles(rows);
          });
        });
      });
    }

    function fetchArchivedTickets(options) {
      return fetchTickets({
        onlyArchived: true,
        includeRequesterProfiles: !!(options && options.includeRequesterProfiles)
      });
    }

    function fetchHistory(ticketId) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("ticket_history")
            .select("*,actor:profiles(full_name)")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true })
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return (res.data || []).map(decorateHistoryRow);
        });
      });
    }

    function detectTicketsLocationColumn() {
      if (hasTicketsLocationColumn !== null) {
        return $q.when(hasTicketsLocationColumn);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("tickets").select("location").limit(1)).then(function (res) {
          if (res && res.error) {
            hasTicketsLocationColumn = false;
            return false;
          }
          hasTicketsLocationColumn = true;
          return true;
        }).catch(function () {
          hasTicketsLocationColumn = false;
          return false;
        });
      });
    }

    function detectTicketsProblemDetailsColumn() {
      if (hasTicketsProblemDetailsColumn !== null) {
        return $q.when(hasTicketsProblemDetailsColumn);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("tickets").select("problem_details").limit(1)).then(function (res) {
          if (res && res.error) {
            hasTicketsProblemDetailsColumn = false;
            return false;
          }
          hasTicketsProblemDetailsColumn = true;
          return true;
        }).catch(function () {
          hasTicketsProblemDetailsColumn = false;
          return false;
        });
      });
    }

    function detectTicketsContactEmailColumn() {
      if (hasTicketsContactEmailColumn !== null) {
        return $q.when(hasTicketsContactEmailColumn);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("tickets").select("contact_email").limit(1)).then(function (res) {
          if (res && res.error) {
            hasTicketsContactEmailColumn = false;
            return false;
          }
          hasTicketsContactEmailColumn = true;
          return true;
        }).catch(function () {
          hasTicketsContactEmailColumn = false;
          return false;
        });
      });
    }

    function detectTicketsArchiveColumns() {
      if (hasTicketsArchiveColumns !== null) {
        return $q.when(hasTicketsArchiveColumns);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("tickets").select("is_archived,archived_at,archived_by").limit(1)).then(function (res) {
          if (res && res.error) {
            hasTicketsArchiveColumns = false;
            return false;
          }
          hasTicketsArchiveColumns = true;
          return true;
        }).catch(function () {
          hasTicketsArchiveColumns = false;
          return false;
        });
      });
    }

    function normalizeTicketEmail(value) {
      return String(value || "").trim().toLowerCase().replace(/\s+/g, "") || null;
    }

    function buildProblemDetails(payload) {
      var details = {};
      [
        "bookingReference",
        "flightNumber",
        "flightDate",
        "originAirport",
        "destinationAirport",
        "passengerName",
        "contactEmail",
        "contactPhone",
        "frequentFlyerNumber",
        "issueCategory",
        "otherCategoryDescription",
        "baggageType",
        "baggageTagNumber",
        "assistanceType",
        "assistanceDetail",
        "cancellationReason",
        "preferredAlternative",
        "refundType",
        "originalPaymentMethod",
        "checkInMethod",
        "boardingPassIssue",
        "itemDescription",
        "locationLost",
        "description"
      ].forEach(function (key) {
        var value = payload ? payload[key] : null;
        details[key] = value === undefined || value === null ? "" : value;
      });
      return details;
    }

    function createTicket(payload) {
      var priority = classifyPriority(
        payload.impact,
        payload.urgency,
        payload.issueCategory || payload.category
      );
      var now = new Date();
      var slaDeadline = new Date(now.getTime() + slaMinutesFor(priority) * 60000).toISOString();
      return $q.all({
        supportsLocation: detectTicketsLocationColumn(),
        supportsProblemDetails: detectTicketsProblemDetailsColumn(),
        supportsContactEmail: detectTicketsContactEmailColumn()
      }).then(function (support) {
        return SupabaseService.assertConfigured().then(function () {
          var row = {
            ticket_code: "INC-" + Date.now().toString().slice(-6),
            title: payload.title,
            description: payload.description || "",
            category_id: payload.category_id,
            requester_name: payload.requester_name,
            requester_id: normalizeOptionalUuid(payload.requester_id),
            impact: payload.impact,
            urgency: payload.urgency,
            priority: priority,
            severity: payload.severity,
            status: "Aberto",
            sla_deadline: slaDeadline,
            assigned_to: normalizeOptionalUuid(payload.assigned_to),
            queue_id: normalizeOptionalUuid(payload.queue_id)
          };
          if (support.supportsLocation) {
            row.location = String(payload.location || "").trim() || null;
          }
          if (support.supportsProblemDetails) {
            row.problem_details = payload.problem_details || buildProblemDetails(payload);
          }
          if (support.supportsContactEmail) {
            row.contact_email = normalizeTicketEmail(payload.contactEmail);
          }
          return $q.when(
            client.from("tickets").insert([row]).select("*,categories(name),queue:queues(name),assignee:profiles!assigned_to(full_name)").single()
          ).then(function (res) {
            if (res.error) { throw res.error; }
            return decorateTicketRow(res.data);
          });
        });
      });
    }

    function updateTicket(ticketId, patch) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client.from("tickets").update(patch).eq("id", ticketId).select("*,categories(name),queue:queues(name),assignee:profiles!assigned_to(full_name)").single()
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return decorateTicketRow(res.data);
        });
      });
    }

    function assignTicket(ticketId, userId) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("tickets")
            .update({ assigned_to: normalizeOptionalUuid(userId) })
            .eq("id", ticketId)
            .select("*,categories(name),queue:queues(name),assignee:profiles!assigned_to(full_name)")
            .single()
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return decorateTicketRow(res.data);
        });
      });
    }

    function deleteTicket(ticketId) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("tickets").delete().eq("id", ticketId)).then(function (res) {
          if (res.error) { throw res.error; }
          return true;
        });
      });
    }

    function deleteArchivedTicket(ticketId) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("tickets")
            .delete()
            .eq("id", ticketId)
            .eq("is_archived", true)
        ).then(function (res) {
          if (res.error) {
            console.error("[HelpOn][TicketService.deleteArchivedTicket]", SupabaseService.getSafeError(res.error), res.error);
            throw res.error;
          }
          return true;
        });
      });
    }

    function archiveTicket(ticketId, actorId) {
      return detectTicketsArchiveColumns().then(function (supportsArchive) {
        if (!supportsArchive) {
          throw new Error("As colunas de arquivamento ainda não existem em public.tickets.");
        }
        return SupabaseService.assertConfigured().then(function () {
          return $q.when(
            client
              .from("tickets")
              .update({
                is_archived: true,
                archived_at: new Date().toISOString(),
                archived_by: actorId || null
              })
              .eq("id", ticketId)
              .eq("status", "Fechado")
              .select("*")
              .maybeSingle()
          ).then(function (res) {
            if (res.error) {
              console.error("[HelpOn][TicketService.archiveTicket]", SupabaseService.getSafeError(res.error), res.error);
              throw res.error;
            }
            if (!res.data) {
              throw new Error("Nenhum chamado fechado foi encontrado para arquivar. Verifique se o status ainda é Fechado.");
            }
            return decorateTicketRow(res.data);
          });
        });
      });
    }

    return {
      statusFlow: statusFlow,
      classifyPriority: classifyPriority,
      priorityForCategory: priorityForCategory,
      priorityInputsForCategory: priorityInputsForCategory,
      getSlaDeadline: getSlaDeadline,
      getRemainingSLA: getRemainingSLA,
      getStats: getStats,
      rememberProfileName: rememberProfileName,
      fetchCategories: fetchCategories,
      fetchTickets: fetchTickets,
      fetchArchivedTickets: fetchArchivedTickets,
      fetchHistory: fetchHistory,
      createTicket: createTicket,
      updateTicket: updateTicket,
      assignTicket: assignTicket,
      archiveTicket: archiveTicket,
      deleteArchivedTicket: deleteArchivedTicket,
      deleteTicket: deleteTicket
    };
  }

  QueueService.$inject = ["$q", "SupabaseService"];
  function QueueService($q, SupabaseService) {
    var client = SupabaseService.client;
    function fetchQueues() {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("queues").select("id,name,description").order("name")).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data || [];
        });
      });
    }
    return {
      fetchQueues: fetchQueues
    };
  }

  NotificationService.$inject = ["$q", "SupabaseService"];
  function NotificationService($q, SupabaseService) {
    var client = SupabaseService.client;

    function search(userId, query, limit) {
      var q = (query || "").trim();
      if (!userId) {
        return $q.when([]);
      }
      if (!q) {
        return fetchLatest(userId, limit || 10);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .or("title.ilike.%" + q + "%,content.ilike.%" + q + "%")
            .order("created_at", { ascending: false })
            .limit(limit || 20)
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data || [];
        });
      });
    }

    function fetchUnread(userId) {
      if (!userId) {
        return $q.when([]);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .eq("is_read", false)
            .order("created_at", { ascending: false })
            .limit(20)
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data || [];
        });
      });
    }

    function fetchLatest(userId, limit) {
      if (!userId) {
        return $q.when([]);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit || 10)
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data || [];
        });
      });
    }

    function markRead(notificationId) {
      if (!notificationId) {
        return $q.when(true);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client.from("notifications").update({ is_read: true }).eq("id", notificationId).select("id").single()
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return true;
        });
      });
    }

    function markAllRead(userId) {
      if (!userId) {
        return $q.when(true);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false)
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return true;
        });
      });
    }

    function clearAll(userId) {
      if (!userId) {
        return $q.when(true);
      }
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client.from("notifications").delete().eq("user_id", userId).select("id")
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return true;
        });
      });
    }

    function notify(userId, title, content, type) {
      if (!userId) {
        return $q.when(null);
      }
      var row = {
        user_id: userId,
        title: String(title || "Notification"),
        content: String(content || ""),
        type: String(type || "info")
      };
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(client.from("notifications").insert([row]).select("*").single()).then(function (res) {
          if (res.error) { throw res.error; }
          return res.data;
        });
      });
    }

    return {
      search: search,
      fetchUnread: fetchUnread,
      fetchLatest: fetchLatest,
      markRead: markRead,
      markAllRead: markAllRead,
      clearAll: clearAll,
      notify: notify
    };
  }

  CommentService.$inject = ["$q", "SupabaseService"];
  function CommentService($q, SupabaseService) {
    var client = SupabaseService.client;

    function decorateCommentRow(row) {
      if (!row) {
        return row;
      }
      var author = row.author || null;
      row.author = {
        id: row.author_id || null,
        full_name: author && author.full_name ? author.full_name : "Unknown user"
      };
      return row;
    }

    function fetchComments(ticketId) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("ticket_comments")
            .select("*,author:profiles(full_name)")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true })
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return (res.data || []).map(decorateCommentRow);
        });
      });
    }

    function addComment(ticketId, authorId, content) {
      return SupabaseService.assertConfigured().then(function () {
        return $q.when(
          client
            .from("ticket_comments")
            .insert([{
              ticket_id: ticketId,
              author_id: authorId,
              content: String(content || "").trim(),
              is_internal: false
            }])
            .select("*,author:profiles(full_name)")
            .single()
        ).then(function (res) {
          if (res.error) { throw res.error; }
          return decorateCommentRow(res.data);
        });
      });
    }

    return {
      fetchComments: fetchComments,
      addComment: addComment
    };
  }

  function AutomationService() {
    var rules = [
      {
        name: "Alta Severidade",
        when: function (ticket) { return ticket.severity === "Alta"; },
        message: "Card marcado com gradiente neon e prioridade monitorada em tempo real."
      },
      {
        name: "Urgente Escalonado",
        when: function (ticket) { return ticket.priority === "Urgente"; },
        message: "Escalonado para resposta imediata com SLA agressivo."
      }
    ];

    return {
      evaluate: function (ticket) {
        return rules.filter(function (rule) { return rule.when(ticket); }).map(function (rule) {
          return { ruleName: rule.name, ticketCode: ticket.ticket_code || ticket.id, message: rule.message };
        });
      }
    };
  }

  function KPIService() {
    function minutesBetween(a, b) {
      return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
    }

    function isResolvedTicket(ticket) {
      return ticket && (ticket.status === "Resolvido" || ticket.status === "Fechado");
    }

    function safeDateMs(value) {
      if (!value) { return null; }
      var ms = new Date(value).getTime();
      return isFinite(ms) && ms > 0 ? ms : null;
    }

    function getResolutionEndMs(ticket) {
      if (!ticket) { return null; }
      var resolvedAt = safeDateMs(ticket.resolved_at);
      if (resolvedAt) { return resolvedAt; }
      var updatedAt = safeDateMs(ticket.updated_at);
      if (updatedAt) { return updatedAt; }
      return null;
    }

    function getResolutionMinutes(ticket) {
      if (!ticket) { return null; }
      var startMs = safeDateMs(ticket.created_at);
      var endMs = getResolutionEndMs(ticket);
      if (!startMs || !endMs) { return null; }
      var diff = Math.max(0, endMs - startMs);
      var minutes = Math.round(diff / 60000);
      return isFinite(minutes) && minutes >= 0 ? minutes : null;
    }

    function average(values) {
      if (!values || !values.length) { return 0; }
      var sum = values.reduce(function (acc, v) { return acc + (isFinite(v) ? v : 0); }, 0);
      return sum / values.length;
    }

    function median(values) {
      if (!values || !values.length) { return 0; }
      var sorted = values.slice().sort(function (a, b) { return a - b; });
      var mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function percentile(values, p) {
      if (!values || !values.length) { return 0; }
      var sorted = values.slice().sort(function (a, b) { return a - b; });
      var index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    }

    function toHours(minutes) {
      if (!isFinite(minutes) || minutes < 0) { return 0; }
      return minutes / 60;
    }

    function classifyGeneralMttr(hours) {
      if (!isFinite(hours) || hours < 0) { return { label: "N/A", class: "mttr-status-unknown" }; }
      if (hours <= 8) { return { label: "Ótimo", class: "mttr-status-great" }; }
      if (hours <= 24) { return { label: "Bom", class: "mttr-status-good" }; }
      if (hours <= 48) { return { label: "Atenção", class: "mttr-status-attention" }; }
      if (hours <= 72) { return { label: "Ruim", class: "mttr-status-bad" }; }
      return { label: "Crítico", class: "mttr-status-critical" };
    }

    function classifyPriorityMttr(priority, hours) {
      if (!isFinite(hours) || hours < 0) { return { label: "N/A", class: "mttr-status-unknown" }; }
      var thresholds;
      switch (priority) {
        case "Urgente":
          thresholds = { great: 1, good: 4, attention: 8 };
          break;
        case "Alta":
          thresholds = { great: 4, good: 8, attention: 24 };
          break;
        case "Média":
          thresholds = { great: 24, good: 48, attention: 72 };
          break;
        case "Baixa":
          thresholds = { great: 48, good: 96, attention: 120 };
          break;
        default:
          thresholds = { great: 8, good: 24, attention: 48 };
      }
      if (hours <= thresholds.great) { return { label: "Ótimo", class: "mttr-status-great" }; }
      if (hours <= thresholds.good) { return { label: "Bom", class: "mttr-status-good" }; }
      if (hours <= thresholds.attention) { return { label: "Atenção", class: "mttr-status-attention" }; }
      return { label: "Ruim/Crítico", class: "mttr-status-bad" };
    }

    function buildMttrGroup(tickets, label, classifier) {
      var validTickets = tickets.filter(function (t) {
        var mins = getResolutionMinutes(t);
        return mins !== null && isFinite(mins) && mins >= 0;
      });
      if (!validTickets.length) {
        return {
          label: label,
          count: 0,
          averageHours: 0,
          medianHours: 0,
          p90Hours: 0,
          statusLabel: "N/A",
          statusClass: "mttr-status-unknown",
          barValue: 0
        };
      }
      var minutes = validTickets.map(getResolutionMinutes).filter(function (m) { return m !== null; });
      var avgHours = toHours(average(minutes));
      var classification = classifier ? classifier(avgHours) : classifyGeneralMttr(avgHours);
      var maxHours = toHours(Math.max.apply(Math, minutes));
      return {
        label: label,
        count: validTickets.length,
        averageHours: avgHours.toFixed(1),
        medianHours: toHours(median(minutes)).toFixed(1),
        p90Hours: toHours(percentile(minutes, 90)).toFixed(1),
        statusLabel: classification.label,
        statusClass: classification.class,
        barValue: Math.min(100, maxHours > 0 ? (avgHours / maxHours) * 100 : 0)
      };
    }

    function uniqueTickets(tickets) {
      var seen = {};
      return (tickets || []).filter(function (ticket) {
        if (!ticket) { return false; }
        var id = ticket.id ? String(ticket.id) : "";
        if (!id) { return true; }
        if (seen[id]) { return false; }
        seen[id] = true;
        return true;
      });
    }

    return {
      compute: function (tickets) {
        tickets = uniqueTickets(tickets);
        var resolved = tickets.filter(isResolvedTicket);
        var closedTickets = tickets.filter(function (t) {
          return t && t.status === "Fechado";
        });
        var withinSla = resolved.filter(function (t) {
          if (!t.resolved_at || !t.sla_deadline) { return false; }
          return new Date(t.resolved_at).getTime() <= new Date(t.sla_deadline).getTime();
        }).length;

        var validResolved = resolved.filter(function (t) {
          var mins = getResolutionMinutes(t);
          return mins !== null && isFinite(mins) && mins >= 0;
        });
        var ignoredCount = resolved.length - validResolved.length;

        var avgMin = 0;
        var avgHours = 0;
        var medianHours = 0;
        var p90Hours = 0;
        var minHours = 0;
        var maxHours = 0;
        var statusLabel = "N/A";
        var statusClass = "mttr-status-unknown";
        var outlierWarning = false;
        var outlierText = "";

        if (validResolved.length > 0) {
          var minutes = validResolved.map(getResolutionMinutes).filter(function (m) { return m !== null; });
          avgMin = Math.round(average(minutes));
          avgHours = toHours(avgMin);
          medianHours = toHours(median(minutes));
          p90Hours = toHours(percentile(minutes, 90));
          minHours = toHours(Math.min.apply(Math, minutes));
          maxHours = toHours(Math.max.apply(Math, minutes));

          var classification = classifyGeneralMttr(avgHours);
          statusLabel = classification.label;
          statusClass = classification.class;

          if (validResolved.length >= 3 && maxHours >= 3 * medianHours) {
            outlierWarning = true;
            outlierText = "A média pode estar elevada por um chamado muito antigo. Consulte também a mediana e o P90.";
          }
        }

        var byPriority = [];
        var priorities = ["Urgente", "Alta", "Média", "Baixa"];
        priorities.forEach(function (prio) {
          var ticketsByPrio = validResolved.filter(function (t) { return t.priority === prio; });
          byPriority.push(buildMttrGroup(ticketsByPrio, prio, function (h) { return classifyPriorityMttr(prio, h); }));
        });

        var bySeverity = [];
        var severities = ["Baixa", "Média", "Alta", "Crítica"];
        severities.forEach(function (sev) {
          var ticketsBySev = validResolved.filter(function (t) { return t.severity === sev; });
          bySeverity.push(buildMttrGroup(ticketsBySev, sev, null));
        });

        var last30d = null;
        var thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        var recentResolved = validResolved.filter(function (t) {
          var resolvedMs = getResolutionEndMs(t);
          return resolvedMs && resolvedMs >= thirtyDaysAgo;
        });
        if (recentResolved.length > 0) {
          var recentMinutes = recentResolved.map(getResolutionMinutes).filter(function (m) { return m !== null; });
          last30d = toHours(average(recentMinutes)).toFixed(1);
        }

        return {
          mttr: avgHours.toFixed(1),
          slaCompliance: resolved.length ? Math.round((withinSla / resolved.length) * 100) : 0,
          backlog: tickets.filter(function (t) { return t.status !== "Resolvido" && t.status !== "Fechado"; }).length,
          closedCount: closedTickets.length,
          mttrDetails: {
            sampleSize: validResolved.length,
            ignoredCount: ignoredCount,
            averageHours: avgHours.toFixed(1),
            medianHours: medianHours.toFixed(1),
            p90Hours: p90Hours.toFixed(1),
            minHours: minHours.toFixed(1),
            maxHours: maxHours.toFixed(1),
            statusLabel: statusLabel,
            statusClass: statusClass,
            outlierWarning: outlierWarning,
            outlierText: outlierText,
            byPriority: byPriority,
            bySeverity: bySeverity,
            last30d: last30d
          }
        };
      },
      complianceBySeverity: function (tickets) {
        var levels = ["Baixa", "Média", "Alta", "Crítica"];
        return levels.map(function (level) {
          var rows = tickets.filter(function (t) { return t.severity === level && (t.status === "Resolvido" || t.status === "Fechado"); });
          var ok = rows.filter(function (t) {
            return t.resolved_at && t.sla_deadline && new Date(t.resolved_at).getTime() <= new Date(t.sla_deadline).getTime();
          }).length;
          var pct = rows.length ? Math.round((ok / rows.length) * 100) : 0;
          return { label: level.charAt(0), value: Math.max(8, Math.round(pct * 1.1)) };
        });
      }
    };
  }

  MainController.$inject = ["$scope", "$location", "$interval", "$timeout", "$q", "$document", "SupabaseService", "AuthService", "ProfileService", "TicketService", "NotificationService", "QueueService", "CommentService", "AutomationService", "KPIService"];
  function MainController($scope, $location, $interval, $timeout, $q, $document, SupabaseService, AuthService, ProfileService, TicketService, NotificationService, QueueService, CommentService, AutomationService, KPIService) {
    var vm = this;
    vm.isSidebarCollapsed = false;
    vm.currentRoute = "dashboard";
    vm.viewTitle = "Dashboard de Performance";
    vm.now = new Date();
    vm.slaNow = new Date();
    vm.connectionOk = true;
    vm.loadingCreate = false;
    vm.user = null;
    vm.message = "";
    vm.auth = { email: "", password: "", loading: false };
    vm.maxBirthDate = new Date().toISOString().slice(0, 10);
    vm.register = {
      email: "",
      password: "",
      legal_first_name: "",
      last_name: "",
      birth_date: "",
      document_number: "",
      document_country: "",
      nationality: "",
      gender: "",
      phone_number: "",
      country: "",
      state: "",
      city: "",
      role: "user"
    };
    vm.profile = null;
    vm.profileComplete = false;
    vm.authLocked = false;
    vm.authLockRemaining = 0;
    vm.severityLevels = ["Baixa", "Média", "Alta", "Crítica"];
    vm.newTicketPriority = null;
    vm.showMttrAnalysis = false;
    vm.impactOptions = [
      { value: "Baixo", label: "Baixo - Afeta apenas este usuário" },
      { value: "Médio", label: "Médio - Afeta um departamento ou processo" },
      { value: "Alto", label: "Alto - Afeta múltiplos departamentos" },
      { value: "Crítico", label: "Crítico - Paralisação geral" }
    ];
    vm.urgencyOptions = [
      { value: "Baixa", label: "Baixa - Pode aguardar até 5 dias" },
      { value: "Média", label: "Média - Necessário em até 24h" },
      { value: "Alta", label: "Alta - Necessário em até 4h" },
      { value: "Crítica", label: "Crítica - Imediato" }
    ];

    $scope.$watchGroup(["vm.newTicket.impact", "vm.newTicket.urgency", "vm.newTicket.issueCategory"], function (newVals) {
      var impact = newVals[0];
      var urgency = newVals[1];
      var category = newVals[2];

      if (category) {
        vm.newTicketPriority = TicketService.classifyPriority(impact, urgency, category);
      } else if (impact && urgency) {
        vm.newTicketPriority = TicketService.classifyPriority(impact, urgency);
      } else {
        vm.newTicketPriority = null;
      }
    });

    function computeFlightOnPriority(issueCategory) {
      return TicketService.priorityInputsForCategory(issueCategory || "Outro");
    }

    vm.recalcPriority = function () {
      var cat = vm.newTicket.issueCategory;

      if (cat) {
        var computed = computeFlightOnPriority(cat);
        vm.newTicket.impact = computed.impact;
        vm.newTicket.urgency = computed.urgency;
        vm.newTicketPriority = computed.priority;
      } else {
        var fallback = TicketService.priorityInputsForCategory("Outro");
        vm.newTicket.impact = fallback.impact;
        vm.newTicket.urgency = fallback.urgency;
        vm.newTicketPriority = fallback.priority;
      }
    };


    $scope.$watch("vm.newTicket.issueCategory", function () {
      vm.recalcPriority();
    });

    vm.statuses = ["Aberto", "Pendente", "Em Andamento", "Em Espera", "Resolvido", "Fechado"];
    var ROLE_PERMISSIONS = {
      user: {
        canCreateTickets: true,
        canAssign: false,
        canAdvanceStatus: false,
        canDelete: false,
        canArchive: false,
        canDeleteArchived: false,
        canSeeAllTickets: false,
        visibleStatuses: ["Aberto", "Em Andamento", "Resolvido", "Fechado"]
      },
      agent: {
        canCreateTickets: false,
        canAssign: true,
        canAdvanceStatus: true,
        canDelete: false,
        canArchive: true,
        canDeleteArchived: false,
        canSeeAllTickets: true,
        visibleStatuses: ["Aberto", "Pendente", "Em Andamento", "Em Espera", "Resolvido", "Fechado"]
      },
      admin: {
        canCreateTickets: false,
        canAssign: true,
        canAdvanceStatus: true,
        canDelete: true,
        canArchive: true,
        canDeleteArchived: true,
        canSeeAllTickets: true,
        visibleStatuses: ["Aberto", "Pendente", "Em Andamento", "Em Espera", "Resolvido", "Fechado"]
      }
    };
    vm.categories = [];
    vm.queues = [];
    vm.selectedQueue = "";
    vm.tickets = [];
    vm.kpiTickets = [];
    vm.archivedTickets = [];
    vm.archivedLoading = false;
    vm.archivedSearch = "";
    vm.archivedStatusFilter = "";
    vm.archivedQueueFilter = "";
    vm.automationLog = [];
    vm.kpis = { mttr: "0.0", slaCompliance: 0, backlog: 0, closedCount: 0 };
    vm.slaSeries = [];
    vm.stats = { total: 0, slaOk: 0, slaBreached: 0, byStatus: {} };
    vm.notifications = [];
    vm.unreadNotifications = 0;
    vm.notificationsOpen = false;
    vm.isNewNotification = false;
    vm.toasts = [];
    vm.newTicket = defaultFormState();
    resetNewTicketForm();
    vm.activeTicketId = null;
    vm.comments = [];
    vm.commentDraft = "";
    vm.commentsLoading = false;
    vm.commentSending = false;
    vm.lastCommentId = null;
    vm.activeTab = "comments";
    vm.history = [];
    vm.historyLoading = false;
    vm.permissions = angular.copy(ROLE_PERMISSIONS.user);
    vm.visibleStatuses = vm.permissions.visibleStatuses.slice();

    vm.toggleSidebar = function () { vm.isSidebarCollapsed = !vm.isSidebarCollapsed; };
    vm.toggleMttrAnalysis = function () { vm.showMttrAnalysis = !vm.showMttrAnalysis; };
    vm.priorityClass = function (priority) { return "priority-" + normalize(priority); };
    vm.severityClass = function (severity) { return "severity-" + normalize(severity); };
    vm.commentInitials = commentInitials;
    vm.isAdmin = function () { return currentRole() === "admin"; };
    vm.isAgent = function () { return currentRole() === "agent"; };
    vm.isUser = function () { return currentRole() === "user"; };
    vm.canCreateTickets = function () {
      return !!(vm.permissions && vm.permissions.canCreateTickets) && vm.isUser();
    };
    vm.roleBadgeLabel = function () {
      if (vm.isAdmin()) { return "Logged in as Admin"; }
      if (vm.isAgent()) { return "Logged in as Agent"; }
      return "Logged in as User";
    };
    vm.toggleRequesterInfo = function (ticket, event) {
      if (event && event.stopPropagation) {
        event.stopPropagation();
      }
      if (!ticket || (!vm.isAdmin() && !vm.isAgent())) {
        return;
      }
      vm.tickets.forEach(function (row) {
        if (row && row.id !== ticket.id) {
          row._showRequesterInfo = false;
          row._showTicketInfo = false;
        }
      });
      ticket._showRequesterInfo = !ticket._showRequesterInfo;
      if (ticket._showRequesterInfo) {
        ticket._showTicketInfo = false;
      }
    };
    vm.closeRequesterInfo = function (ticket) {
      if (ticket) {
        ticket._showRequesterInfo = false;
      }
    };
    vm.toggleTicketInfo = function (ticket, event) {
      if (event && event.stopPropagation) {
        event.stopPropagation();
      }
      if (!ticket || (!vm.isAdmin() && !vm.isAgent())) {
        return;
      }
      vm.tickets.forEach(function (row) {
        if (row && row.id !== ticket.id) {
          row._showRequesterInfo = false;
          row._showTicketInfo = false;
        }
      });
      ticket._showTicketInfo = !ticket._showTicketInfo;
      if (ticket._showTicketInfo) {
        ticket._showRequesterInfo = false;
      }
    };
    vm.closeTicketInfo = function (ticket) {
      if (ticket) {
        ticket._showTicketInfo = false;
      }
    };
    vm.ticketSubjectLabel = ticketSubjectLabel;
    vm.ticketDescriptionLabel = ticketDescriptionLabel;
    vm.ticketEmailLabel = ticketEmailLabel;
    vm.loadArchivedTickets = loadArchivedTickets;
    vm.filteredArchivedTickets = filteredArchivedTickets;
    vm.deleteArchivedTicket = deleteArchivedTicket;
    vm.archivedAtLabel = function (ticket) {
      return formatDateTime(ticket && ticket.archived_at);
    };
    vm.closedAtLabel = function (ticket) {
      return formatDateTime((ticket && ticket.resolved_at) || (ticket && ticket.updated_at));
    };
    vm.toggleArchivedDetails = function (ticket) {
      if (!ticket) { return; }
      ticket._showArchivedDetails = !ticket._showArchivedDetails;
    };
    vm.requesterLocation = function (ticket) {
      var profile = ticket && ticket.requester_profile ? ticket.requester_profile : null;
      var city = profile && profile.city ? profile.city : "";
      var state = profile && profile.state ? profile.state : "";
      var country = profile && profile.country ? profile.country : "";
      var cityState = city && state ? city + " / " + state : (city || state);
      if (cityState && country) {
        return cityState + " - " + country;
      }
      return cityState || country || "Não informado";
    };
    vm.requesterShortId = function (ticket) {
      var id = ticket && ticket.requester_id ? String(ticket.requester_id) : "";
      return id ? id.slice(0, 8) : "Não informado";
    };
    vm.onQueueFilterChange = function () {
      recompute();
    };

    vm.refreshStats = function () {
      vm.stats = TicketService.getStats(scopedTicketsForQueue(), vm.slaNow || vm.now || new Date());
    };

    vm.kanbanBump = false;
    vm.insightsBump = false;

    vm.toggleNotifications = function () {
      vm.notificationsOpen = !vm.notificationsOpen;
      if (vm.notificationsOpen && vm.user && vm.user.id) {
        refreshNotifications();
      }
    };

    vm.markNotificationRead = function (n) {
      if (!n || n.is_read || !n.id) {
        return;
      }
      NotificationService.markRead(n.id).then(function () {
        n.is_read = true;
        refreshUnreadCount();
      }).catch(handleError).finally(safeApply);
    };

    vm.markAllNotificationsRead = function () {
      if (!vm.user || !vm.user.id) {
        return;
      }
      NotificationService.markAllRead(vm.user.id).then(function () {
        vm.notifications.forEach(function (n) { n.is_read = true; });
        refreshUnreadCount();
      }).catch(handleError).finally(safeApply);
    };

    vm.clearAllNotifications = function () {
      if (!vm.user || !vm.user.id) {
        return;
      }
      NotificationService.clearAll(vm.user.id).then(function () {
        vm.notifications = [];
        vm.unreadNotifications = 0;
        pushToast("Notificações", "Caixa de entrada limpa.", "info");
      }).catch(handleError).finally(safeApply);
    };

    vm.signIn = function () {
      if (AuthService.isLocked()) {
        refreshLockStatus();
        vm.message = "Login temporariamente bloqueado por seguranca.";
        return;
      }
      vm.auth.loading = true;
      AuthService.signIn(vm.auth.email, vm.auth.password).then(function (res) {
        if (res.error) { throw res.error; }
        vm.user = res.data.user;
        vm.user.role = "user";
        refreshPermissions();
        vm.message = "Login realizado com sucesso.";
        return loadProfileAndData();
      }).catch(handleError).finally(function () {
        vm.auth.loading = false;
        refreshLockStatus();
        safeApply();
      });
    };

    vm.signUp = function () {
      console.log("[HelpOn][signUp] Submit triggered");
      console.log("[HelpOn][signUp] Register keys:", Object.keys(vm.register || {}));
      var requiredFields = [
        "email",
        "password",
        "legal_first_name",
        "last_name",
        "birth_date",
        "document_number",
        "document_country",
        "nationality",
        "phone_number",
        "country",
        "state",
        "city"
      ];
      var missingFields = requiredFields.filter(function (field) {
        return !String(vm.register[field] || "").trim();
      });
      if (missingFields.length) {
        console.warn("[HelpOn][signUp] Missing fields:", missingFields);
        vm.message = "Preencha todos os campos obrigatórios.";
        return;
      }
      var birthDate = vm.register.birth_date instanceof Date ? vm.register.birth_date : new Date(vm.register.birth_date);
      if (birthDate && !isNaN(birthDate.getTime())) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        birthDate.setHours(0, 0, 0, 0);
        if (birthDate.getTime() > today.getTime()) {
          vm.message = "A data de nascimento nao pode ser futura.";
          return;
        }
      }
      vm.register.document_number = String(vm.register.document_number || "").replace(/\D/g, "").slice(0, 11);
      if (!/^\d{11}$/.test(vm.register.document_number)) {
        vm.message = "Informe um CPF válido com exatamente 11 números.";
        return;
      }
      if (vm.register.gender !== "Feminino" && vm.register.gender !== "Masculino") {
        vm.message = "Selecione uma opção válida de gênero.";
        return;
      }
      vm.auth.loading = true;
      var registerProfile = angular.copy(vm.register);
      delete registerProfile.password;
      AuthService.signUp(vm.register.email, vm.register.password, registerProfile).then(function (res) {
        if (res.error) { throw res.error; }
        var session = res.data && res.data.session;
        var user = res.data.user;
        if (!user || !user.id) {
          vm.message = "Conta criada. Faça login com seu e-mail e senha para acessar.";
          $location.path("/");
          return;
        }
        if (!session || !session.user) {
          vm.message = "Conta criada. Faça login com seu e-mail e senha para acessar.";
          $location.path("/");
          return;
        }
        vm.user = session.user || user;
        vm.user.role = "user";
        refreshPermissions();
        return ProfileService.upsertProfile(registerProfile, vm.user.id).then(function () {
          vm.message = "Conta criada com sucesso.";
          return loadProfileAndData();
        });
      }).catch(function (error) {
        console.error("[HelpOn][signUp] Flow error:", SupabaseService.getSafeError(error));
        handleError(error);
      }).finally(function () {
        vm.auth.loading = false;
        refreshLockStatus();
        safeApply();
      });
    };

    vm.signOut = function () {
      AuthService.signOut().then(function () {
        vm.user = null;
        vm.profile = null;
        vm.profileComplete = false;
        vm.tickets = [];
        vm.kpiTickets = [];
        vm.archivedTickets = [];
        vm.categories = [];
        vm.automationLog = [];
        vm.comments = [];
        vm.history = [];
        vm.activeTicketId = null;
        vm.commentDraft = "";
        vm.lastCommentId = null;
        vm.activeTab = "comments";
        vm.newTicket = defaultFormState();
        resetNewTicketForm();
        vm.notifications = [];
        vm.unreadNotifications = 0;
        vm.notificationsOpen = false;
        vm.toasts = [];
        teardownNotificationsRealtime();
        refreshPermissions();
        vm.message = "Sessão encerrada.";
        $location.path("/");
      }).catch(handleError).finally(safeApply);
    };

    vm.saveProfile = function (profilePayload) {
      if (!vm.user || !vm.user.id) { return; }
      return ProfileService.upsertProfile(profilePayload, vm.user.id).then(function (profile) {
        vm.profile = profile;
        applyRoleFromProfile(profile);
        vm.profileComplete = ProfileService.isProfileComplete();
        vm.message = "Perfil atualizado com sucesso.";
        pushToast("Perfil", "Perfil atualizado com sucesso.", "info");
        if (vm.profileComplete) {
          $location.path("/dashboard");
          return loadData().then(function () {
            return profile;
          });
        }
        return profile;
      }).catch(function (error) {
        handleError(error);
        throw error;
      }).finally(safeApply);
    };

    function cleanText(value) {
      return String(value || "").replace(/[<>]/g, "").trim();
    }

    function compactText(value, maxLen) {
      var cleaned = cleanText(value).replace(/\s+/g, " ");
      return maxLen ? cleaned.slice(0, maxLen) : cleaned;
    }

    function onlyDigits(value) {
      return String(value || "").replace(/\D/g, "");
    }

    function normalizeUpperAlnum(value, maxLen) {
      var cleaned = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      return maxLen ? cleaned.slice(0, maxLen) : cleaned;
    }

    function normalizeUpperLetters(value, maxLen) {
      var cleaned = String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
      return maxLen ? cleaned.slice(0, maxLen) : cleaned;
    }

    var problemDetailKeys = [
      "bookingReference",
      "flightNumber",
      "flightDate",
      "originAirport",
      "destinationAirport",
      "passengerName",
      "contactEmail",
      "contactPhone",
      "frequentFlyerNumber",
      "issueCategory",
      "otherCategoryDescription",
      "baggageType",
      "baggageTagNumber",
      "assistanceType",
      "assistanceDetail",
      "cancellationReason",
      "preferredAlternative",
      "refundType",
      "originalPaymentMethod",
      "checkInMethod",
      "boardingPassIssue",
      "itemDescription",
      "locationLost",
      "description"
    ];

    function rawTicketProblemDetails(ticket) {
      var raw = ticket ? ticket.problem_details : null;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch (error) {
          raw = {};
        }
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        raw = {};
      }
      return raw;
    }

    function ticketInfoText(value) {
      if (value === undefined || value === null) {
        return "";
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
      }
      if (typeof value === "object") {
        return "";
      }
      return cleanText(value).replace(/\s+/g, " ");
    }

    function buildProblemDetailsFromForm(ticket) {
      var source = ticket || {};
      var details = {};
      problemDetailKeys.forEach(function (key) {
        details[key] = source[key] === undefined || source[key] === null ? "" : source[key];
      });
      return details;
    }

    function displayTicketInfo(value) {
      var cleaned = ticketInfoText(value);
      return cleaned || "Não informado";
    }

    function ticketSubjectLabel(ticket) {
      return displayTicketInfo(ticket && ticket.title);
    }

    function ticketDescriptionLabel(ticket) {
      return displayTicketInfo(ticket && ticket.description);
    }

    function ticketEmailLabel(ticket) {
      var details = rawTicketProblemDetails(ticket);
      var email = ticketInfoText(ticket && ticket.contact_email) ||
        ticketInfoText(ticket && ticket.contactEmail) ||
        ticketInfoText(details.contactEmail);
      return displayTicketInfo(email);
    }

    function sanitizeNewTicket() {
      var t = vm.newTicket || {};
      t.title = compactText(t.title, 200);
      t.description = cleanText(t.description).slice(0, 500);
      t.passengerName = cleanText(t.passengerName)
        .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\-\s]/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 100);
      t.contactEmail = cleanText(t.contactEmail).toLowerCase().replace(/\s+/g, "");
      t.contactPhone = cleanText(t.contactPhone).replace(/[^0-9()+\-\s]/g, "").slice(0, 20);

      t.bookingReference = normalizeUpperAlnum(t.bookingReference);
      t.flightNumber = normalizeUpperAlnum(t.flightNumber);
      t.originAirport = normalizeUpperLetters(t.originAirport);
      t.destinationAirport = normalizeUpperLetters(t.destinationAirport);
      t.frequentFlyerNumber = normalizeUpperAlnum(t.frequentFlyerNumber);
      t.baggageTagNumber = onlyDigits(t.baggageTagNumber);

      t.otherCategoryDescription = compactText(t.otherCategoryDescription, 200);
      t.assistanceDetail = compactText(t.assistanceDetail, 200);
      t.preferredAlternative = compactText(t.preferredAlternative, 200);
      t.originalPaymentMethod = compactText(t.originalPaymentMethod, 80);
      t.boardingPassIssue = compactText(t.boardingPassIssue, 200);
      t.itemDescription = compactText(t.itemDescription, 200);
      t.locationLost = compactText(t.locationLost, 200);
      t.category = compactText(t.issueCategory || t.category, 120);
    }

    function validateNewTicketForm() {
      var t = vm.newTicket || {};
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      var phoneDigits = onlyDigits(t.contactPhone);
      var plusIndex = String(t.contactPhone || "").indexOf("+");

      if (!t.title) {
        return { ok: false, message: "Informe o assunto do chamado." };
      }
      if (!t.passengerName || t.passengerName.length < 3) {
        return { ok: false, message: "Informe o nome do passageiro." };
      }
      if (!t.contactEmail || !emailPattern.test(t.contactEmail)) {
        return { ok: false, message: "Informe um e-mail válido." };
      }
      if (!t.contactPhone) {
        return { ok: false, message: "Informe o telefone." };
      }
      if (plusIndex > 0 || String(t.contactPhone || "").indexOf("+", plusIndex + 1) !== -1) {
        return { ok: false, message: "Use o sinal de + apenas no início do telefone." };
      }
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return { ok: false, message: "Informe um telefone válido com 10 a 15 dígitos." };
      }
      if (!t.description || t.description.length < 10) {
        return { ok: false, message: "A descrição precisa ter pelo menos 10 caracteres." };
      }

      if (t.bookingReference && (!/^[A-Z0-9]{6}$/.test(t.bookingReference) || !/[A-Z]/.test(t.bookingReference) || !/\d/.test(t.bookingReference))) {
        return { ok: false, message: "O PNR deve ter 6 caracteres, com letras e números. Exemplo: ABC123." };
      }
      if (t.flightNumber && !/^FON\d{3,4}$/.test(t.flightNumber)) {
        return { ok: false, message: "O número do voo deve seguir o padrão FON123 ou FON1234." };
      }
      if (t.originAirport && !/^[A-Z]{3}$/.test(t.originAirport)) {
        return { ok: false, message: "A origem deve usar código IATA com 3 letras. Exemplo: GRU." };
      }
      if (t.destinationAirport && !/^[A-Z]{3}$/.test(t.destinationAirport)) {
        return { ok: false, message: "O destino deve usar código IATA com 3 letras. Exemplo: JFK." };
      }
      if (t.originAirport && t.destinationAirport && t.originAirport === t.destinationAirport) {
        return { ok: false, message: "Origem e destino não podem ser iguais." };
      }
      if (t.frequentFlyerNumber && (!/^[A-Z0-9]{6,16}$/.test(t.frequentFlyerNumber) || !/[A-Z]/.test(t.frequentFlyerNumber) || !/\d/.test(t.frequentFlyerNumber))) {
        return { ok: false, message: "O programa de fidelidade deve ter 6 a 16 caracteres, com letras e números." };
      }
      if (t.baggageTagNumber && !/^\d{6,10}$/.test(t.baggageTagNumber)) {
        return { ok: false, message: "A etiqueta de bagagem deve conter apenas números, entre 6 e 10 dígitos." };
      }
      if (t.originalPaymentMethod && onlyDigits(t.originalPaymentMethod).length >= 13 && onlyDigits(t.originalPaymentMethod).length <= 19) {
        return { ok: false, message: "Não informe o número completo do cartão. Use apenas os 4 últimos dígitos." };
      }

      return { ok: true };
    }

    function ensureTicketPriorityDefaults() {
      if (!vm.newTicket.issueCategory) {
        vm.newTicket.issueCategory = "Outro";
        vm.newTicket.category = "Outro";
      }

      var computed = TicketService.priorityInputsForCategory(vm.newTicket.issueCategory);

      vm.newTicket.impact = computed.impact;
      vm.newTicket.urgency = computed.urgency;
      vm.newTicketPriority = computed.priority;
    }

    vm.createTicket = function () {
      if (vm.loadingCreate) { return; }
      if (!vm.canCreateTickets()) {
        vm.message = "Somente usuários podem abrir chamados.";
        pushToast("Sem permissão", "Somente usuários podem abrir chamados.", "warning");
        return;
      }
      sanitizeNewTicket();
      vm.recalcPriority();

      var validation = validateNewTicketForm();
      if (!validation.ok) {
        vm.loadingCreate = false;
        vm.message = validation.message;
        pushToast("Validação", validation.message, "warning");
        return;
      }
      ensureTicketPriorityDefaults();
      vm.loadingCreate = true;

      function normalizeKey(value) {
        return String(value || "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/[–—]/g, "-")
          .replace(/[áãâà]/g, "a")
          .replace(/[éê]/g, "e")
          .replace(/[í]/g, "i")
          .replace(/[óôõ]/g, "o")
          .replace(/[ú]/g, "u")
          .replace(/ç/g, "c");
      }

      function findCategoryIdByLabel(label) {
        var wanted = normalizeKey(label);
        if (!wanted || !vm.categories || !vm.categories.length) { return null; }
        var match = vm.categories.find(function (c) { return c && normalizeKey(c.name) === wanted; });
        return match ? match.id : null;
      }

      function resolveSafeCategoryId(selectedLabel) {
        var id = findCategoryIdByLabel(selectedLabel);
        if (id) { return id; }
        id = findCategoryIdByLabel("Triage") || findCategoryIdByLabel("General") || findCategoryIdByLabel("Geral");
        if (id) { return id; }
        return (vm.categories && vm.categories.length && vm.categories[0] && vm.categories[0].id) ? vm.categories[0].id : null;
      }

      var categoryLabel = String(vm.newTicket.category || "").trim();
      var categoryId = resolveSafeCategoryId(categoryLabel);

      var priority = TicketService.classifyPriority(
        vm.newTicket.impact,
        vm.newTicket.urgency,
        categoryLabel
      );
      var slaDeadline = TicketService.getSlaDeadline(priority);

      var payload = angular.extend({}, vm.newTicket, {
        requester_id: vm.user && vm.user.id ? vm.user.id : null,
        category_id: categoryId,
        impact: vm.newTicket.impact,
        urgency: vm.newTicket.urgency,
        priority: priority,
        severity: vm.newTicket.severity || vm.severityLevels[1],
        sla_deadline: slaDeadline,
        queue_id: vm.newTicket.queue_id || null,
        location: vm.newTicket.asset_tag || null,
        problem_details: buildProblemDetailsFromForm(vm.newTicket)
      });

      TicketService.createTicket(payload).then(function (ticket) {
        vm.tickets.unshift(ticket);
        vm.automationLog = AutomationService.evaluate(ticket).concat(vm.automationLog);
        vm.newTicket = defaultFormState();
        resetNewTicketForm();
        vm.newTicketPriority = null;
        recompute();
        vm.message = "Chamado criado no PostgreSQL com sucesso.";
        pushToast("Chamado criado", "#" + (ticket.ticket_code || ticket.id) + " salvo com sucesso.", "info");
        if (vm.user && vm.user.id) {
          NotificationService.notify(vm.user.id, "Chamado criado", "#" + (ticket.ticket_code || ticket.id) + " salvo com sucesso.", "info").then(function (n) {
            if (n) { vm.notifications.unshift(n); refreshUnreadCount(); }
          });
        }
      }).catch(function (error) {
        vm.loadingCreate = false;
        safeApply();
        handleError(error);
      }).finally(function () {
        vm.loadingCreate = false;
        safeApply();
      });
    };

    vm.advanceStatus = function (ticket) {
      if (!vm.permissions.canAdvanceStatus) {
        pushToast("Sem permissão", "Você não tem permissão para alterar status.", "warning");
        vm.message = "Você não tem permissão para alterar status.";
        return;
      }
      if (!ticket || !ticket.id || ticket._busy) { return; }
      var flow = TicketService.statusFlow;
      var currentIndex = flow.indexOf(ticket.status);
      if (currentIndex < 0 || currentIndex === flow.length - 1) { return; }
      var nextStatus = flow[currentIndex + 1];
      var patch = { status: nextStatus };
      if ((nextStatus === "Resolvido" || nextStatus === "Fechado") && !ticket.resolved_at) {
        patch.resolved_at = new Date().toISOString();
      }
      ticket._busy = true;
      TicketService.updateTicket(ticket.id, patch).then(function (saved) {
        mergeTicket(saved);
        vm.automationLog = AutomationService.evaluate(saved).concat(vm.automationLog);
        recompute();
        pushToast("Status atualizado", "#" + (saved.ticket_code || saved.id) + " → " + nextStatus, "info");
        if (vm.user && vm.user.id) {
          NotificationService.notify(vm.user.id, "Status atualizado", "#" + (saved.ticket_code || saved.id) + " → " + nextStatus, "info").then(function (n) {
            if (n) { vm.notifications.unshift(n); refreshUnreadCount(); }
          });
        }
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.reopenTicket = function (ticket) {
      if (!vm.permissions.canAdvanceStatus) {
        pushToast("Sem permissão", "Você não tem permissão para reabrir chamados.", "warning");
        return;
      }
      if (!ticket || !ticket.id || ticket._busy) { return; }
      ticket._busy = true;
      TicketService.updateTicket(ticket.id, { status: "Em Andamento", resolved_at: null }).then(function (saved) {
        mergeTicket(saved);
        recompute();
        pushToast("Chamado reaberto", "#" + (saved.ticket_code || saved.id) + " retornou para Em Andamento.", "info");
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.editTicket = function (ticket) {
      var newTitle = window.prompt("Novo titulo do chamado:", ticket.title);
      if (!newTitle || newTitle === ticket.title) { return; }
      if (!ticket || !ticket.id || ticket._busy) { return; }
      ticket._busy = true;
      TicketService.updateTicket(ticket.id, { title: newTitle }).then(function (saved) {
        mergeTicket(saved);
        vm.message = "Chamado atualizado.";
        recompute();
        pushToast("Chamado atualizado", "#" + (saved.ticket_code || saved.id) + " renomeado.", "info");
        if (vm.user && vm.user.id) {
          NotificationService.notify(vm.user.id, "Chamado atualizado", "#" + (saved.ticket_code || saved.id) + " renomeado.", "info").then(function (n) {
            if (n) { vm.notifications.unshift(n); refreshUnreadCount(); }
          });
        }
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.deleteTicket = function (ticket) {
      if (!ticket || !ticket.id || ticket._busy) { return; }
      if (!vm.permissions.canDelete) {
        pushToast("Sem permissão", "Somente administradores podem excluir chamados.", "warning");
        vm.message = "Somente administradores podem excluir chamados.";
        return;
      }
      if (ticket.status === "Fechado") {
        vm.message = "Chamados fechados devem ser arquivados, não excluídos.";
        pushToast("Use arquivamento", "Chamados fechados devem ser arquivados para preservar o histórico.", "warning");
        return;
      }
      if (!window.confirm("Deseja excluir o chamado " + (ticket.ticket_code || ticket.id) + "?")) { return; }
      ticket._busy = true;
      TicketService.deleteTicket(ticket.id).then(function () {
        vm.tickets = vm.tickets.filter(function (row) { return row.id !== ticket.id; });
        recompute();
        pushToast("Chamado excluído", "#" + (ticket.ticket_code || ticket.id) + " removido.", "warning");
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.archiveTicket = function (ticket) {
      if (!ticket || !ticket.id) { return; }
      if (!vm.permissions.canArchive || (!vm.isAdmin() && !vm.isAgent())) {
        vm.message = "Sem permissão para arquivar chamados.";
        pushToast("Sem permissão", "Somente admin e agent podem arquivar chamados.", "warning");
        return;
      }
      if (ticket.status !== "Fechado") {
        vm.message = "Somente chamados fechados podem ser arquivados.";
        pushToast("Ação não permitida", "Somente chamados fechados podem ser arquivados.", "warning");
        return;
      }
      if (ticket.is_archived) {
        vm.message = "Este chamado já está arquivado.";
        pushToast("Já arquivado", "Este chamado já foi movido para Arquivados.", "info");
        return;
      }
      var ok = window.confirm("Arquivar este chamado fechado? Ele sairá do Kanban e ficará disponível em Arquivados.");
      if (!ok) { return; }
      ticket._busy = true;
      TicketService.archiveTicket(ticket.id, vm.user && vm.user.id).then(function () {
        removeTicketFromActiveList(ticket.id);
        if (vm.currentRoute === "archived") {
          vm.loadArchivedTickets();
        }
        recompute();
        vm.message = "Chamado arquivado com sucesso.";
        pushToast("Chamado arquivado", "O chamado foi movido para Arquivados.", "success");
      }).catch(function (error) {
        console.error("[HelpOn][archiveTicket] erro ao arquivar:", error);
        console.error("[HelpOn][archiveTicket] safe error:", SupabaseService && SupabaseService.getSafeError ? SupabaseService.getSafeError(error) : error);
        vm.message = localizeErrorMessage(error);
        pushToast("Erro ao arquivar", vm.message, "error");
      }).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.claimTicket = function (ticket) {
      if (!vm.permissions.canAssign) {
        pushToast("Sem permissão", "Você não tem permissão para atribuir chamados.", "warning");
        vm.message = "Você não tem permissão para atribuir chamados.";
        return;
      }
      if (!vm.user || !vm.user.id || !ticket || !ticket.id) { return; }
      if (ticket._busy) { return; }
      ticket._busy = true;
      TicketService.assignTicket(ticket.id, vm.user.id).then(function (saved) {
        mergeTicket(saved);
        vm.message = "Chamado atribuído para você.";
        recompute();
        pushToast("Claim", "#" + (saved.ticket_code || saved.id) + " atribuído para você.", "info");
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.releaseTicket = function (ticket) {
      if (!vm.permissions.canAssign) {
        pushToast("Sem permissão", "Você não tem permissão para remover atribuição.", "warning");
        vm.message = "Você não tem permissão para remover atribuição.";
        return;
      }
      if (!vm.user || !vm.user.id || !ticket || !ticket.id) { return; }
      if (!ticket.assigned_to || ticket.assigned_to.id !== vm.user.id) { return; }
      if (ticket._busy) { return; }
      ticket._busy = true;
      TicketService.assignTicket(ticket.id, null).then(function (saved) {
        mergeTicket(saved);
        vm.message = "Atribuição removida.";
        recompute();
        pushToast("Release", "#" + (saved.ticket_code || saved.id) + " liberado.", "info");
      }).catch(handleError).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    };

    vm.toggleTicketDetails = function (ticket) {
      if (!ticket || !ticket.id) { return; }
      if (vm.activeTicketId === ticket.id) {
        vm.activeTicketId = null;
        vm.comments = [];
        vm.history = [];
        vm.commentDraft = "";
        vm.lastCommentId = null;
        return;
      }
      vm.activeTicketId = ticket.id;
      vm.activeTab = "comments";
      vm.comments = [];
      vm.history = [];
      vm.commentDraft = "";
      vm.lastCommentId = null;
      vm.commentsLoading = true;
      vm.historyLoading = true;
      $q.all([
        CommentService.fetchComments(ticket.id),
        TicketService.fetchHistory(ticket.id)
      ]).then(function (all) {
        vm.comments = all[0];
        vm.history = all[1];
        // Add synthetic creation event as first item
        var requesterName = ticket.requester_name || "Usuário";
        var creationEvent = {
          id: "creation_" + ticket.id,
          action: "ticket_created",
          action_label: "abriu o chamado",
          actor_name: requesterName,
          summary: requesterName + " abriu o chamado",
          created_at: ticket.created_at,
          old_label: "",
          new_label: "",
          is_creation_event: true
        };
        vm.history.unshift(creationEvent);
        if (vm.activeTab === "comments") {
          scrollCommentsToBottom(ticket.id);
        }
      }).catch(handleError).finally(function () {
        vm.commentsLoading = false;
        vm.historyLoading = false;
        safeApply();
      });
    };

    vm.sendComment = function (ticket) {
      var content = String(vm.commentDraft || "").trim();
      if (!ticket || !ticket.id || !vm.user || !vm.user.id || !content) { return; }
      if (vm.commentSending) { return; }
      vm.commentSending = true;
      CommentService.addComment(ticket.id, vm.user.id, content).then(function (saved) {
        vm.comments.push(saved);
        vm.lastCommentId = saved.id;
        vm.commentDraft = "";
        scrollCommentsToBottom(ticket.id);
        pushToast("Comentário enviado", "Sua mensagem foi adicionada ao ticket.", "comment");
      }).catch(handleError).finally(function () {
        vm.commentSending = false;
        safeApply();
      });
    };

    function resetNewTicketForm() {
      $timeout(function () {
        if ($scope.newTicketForm) {
          // Sincroniza o viewValue de cada controle com o modelValue atual
          // (evita que valores antigos persistam nos ngModelControllers)
          angular.forEach($scope.newTicketForm, function (control) {
            if (control && typeof control.$setViewValue === "function") {
              control.$viewValue = control.$modelValue;
              control.$render();
              // Re-executa validators para refletir o estado vazio sem marcar dirty
              if (typeof control.$validate === "function") {
                control.$validate();
              }
            }
          });
          $scope.newTicketForm.$setPristine();
          $scope.newTicketForm.$setUntouched();
        }
      }, 0);
    }

    function defaultFormState() {
      return {
        title: "",
        description: "",
        requester_name: (vm.profile && vm.profile.full_name) ? vm.profile.full_name : "",
        category: "",
        asset_tag: "",
        category_id: null,
        // impact/urgency serão calculados dinamicamente pela lógica FlightOn
        impact: "",
        urgency: "",
        severity: vm.severityLevels[1],
        assigned_to: null,
        queue_id: null,
        // Campos específicos da FlightOn
        bookingReference: "",
        flightNumber: "",
        flightDate: null,
        originAirport: "",
        destinationAirport: "",
        passengerName: "",
        contactEmail: "",
        contactPhone: "",
        frequentFlyerNumber: "",
        issueCategory: "",
        otherCategoryDescription: "",
        baggageType: "",
        baggageTagNumber: "",
        assistanceType: "",
        assistanceDetail: "",
        cancellationReason: "",
        preferredAlternative: "",
        refundType: "",
        originalPaymentMethod: "",
        checkInMethod: "",
        boardingPassIssue: "",
        itemDescription: "",
        locationLost: ""
      };
    }

    function normalize(value) {
      return (value || "").toLowerCase().replace(/\s+/g, "-").replace(/[áãâà]/g, "a").replace(/[éê]/g, "e").replace(/[í]/g, "i").replace(/[óôõ]/g, "o").replace(/[ú]/g, "u").replace(/ç/g, "c");
    }

    function groupByStatus() {
      var grouped = {};
      vm.visibleStatuses.forEach(function (status) { grouped[status] = []; });
      var scopedTickets = vm.tickets.filter(function (ticket) {
        if (!vm.selectedQueue) {
          return true;
        }
        return ticket.queue_id === vm.selectedQueue;
      });
      scopedTickets.forEach(function (ticket) {
        if (!grouped[ticket.status]) { return; }
        grouped[ticket.status].push(ticket);
      });
      vm.ticketsByStatus = grouped;
    }

    function mergeTicket(saved) {
      vm.tickets = vm.tickets.map(function (row) {
        if (row.id !== saved.id) {
          return row;
        }
        saved.requester_profile = saved.requester_profile || row.requester_profile || null;
        saved._showRequesterInfo = row._showRequesterInfo || false;
        saved._showTicketInfo = row._showTicketInfo || false;
        if (saved.contact_email === undefined && row.contact_email !== undefined) {
          saved.contact_email = row.contact_email;
        }
        if (saved.problem_details === undefined && row.problem_details !== undefined) {
          saved.problem_details = row.problem_details;
        }
        return saved;
      });
      vm.kpiTickets = (vm.kpiTickets || []).map(function (row) {
        return row && row.id === saved.id ? angular.extend({}, row, saved) : row;
      });
    }

    function commentInitials(comment) {
      var base = (comment && comment.author && comment.author.full_name) || "No Name";
      var parts = String(base).trim().split(/\s+/).filter(Boolean);
      if (!parts.length) { return "NN"; }
      if (parts.length === 1) { return parts[0].charAt(0).toUpperCase(); }
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function scrollCommentsToBottom(ticketId) {
      window.setTimeout(function () {
        var el = window.document.getElementById("comments-thread-" + ticketId);
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }, 30);
    }

    function updateRouteMeta() {
      vm.currentRoute = (($location.path() || "/dashboard").replace("/", "")) || "dashboard";
      if (($location.path() || "") === "/archived") {
        vm.currentRoute = "archived";
        vm.viewTitle = "Chamados Arquivados";
        return;
      }
      if (vm.currentRoute === "tickets") {
        vm.viewTitle = "Gestao de Chamados";
      } else if (vm.currentRoute === "complete-profile") {
        vm.viewTitle = "Completar Perfil";
      } else if (vm.currentRoute === "dashboard" && vm.isUser()) {
        vm.viewTitle = "Bem-vindo ao HelpOn";
      } else {
        vm.viewTitle = "Dashboard de Performance";
      }
    }

    function recompute() {
      groupByStatus();
      var kpiSource = (vm.kpiTickets && vm.kpiTickets.length) ? vm.kpiTickets : vm.tickets;
      vm.kpis = KPIService.compute(kpiSource);
      vm.slaSeries = KPIService.complianceBySeverity(kpiSource);
      maybeNotifyCriticalTickets();
      vm.refreshStats();
      bumpKanban();
      bumpInsights();
    }

    function bumpKanban() {
      vm.kanbanBump = true;
      $timeout(function () {
        vm.kanbanBump = false;
        safeApply();
      }, 250);
    }

    function bumpInsights() {
      vm.insightsBump = true;
      $timeout(function () {
        vm.insightsBump = false;
        safeApply();
      }, 250);
    }

    function scopedTicketsForQueue() {
      return vm.tickets.filter(function (ticket) {
        if (!vm.selectedQueue) {
          return true;
        }
        return ticket.queue_id === vm.selectedQueue;
      });
    }

    function pushToast(title, content, type) {
      var toast = {
        id: "t_" + Date.now() + "_" + Math.random().toString(16).slice(2),
        title: String(title || ""),
        content: String(content || ""),
        type: String(type || "info")
      };
      vm.toasts.unshift(toast);
      $timeout(function () {
        vm.toasts = vm.toasts.filter(function (t) { return t.id !== toast.id; });
        safeApply();
      }, 1500);
    }

    function refreshUnreadCount() {
      vm.unreadNotifications = (vm.notifications || []).filter(function (n) { return !n.is_read; }).length;
    }

    function refreshNotifications() {
      if (!vm.user || !vm.user.id) {
        vm.notifications = [];
        vm.unreadNotifications = 0;
        return $q.when([]);
      }
      return NotificationService.fetchLatest(vm.user.id, 10).then(function (rows) {
        vm.notifications = rows || [];
        refreshUnreadCount();
        return vm.notifications;
      });
    }

    var notificationsChannel = null;
    function setupNotificationsRealtime() {
      teardownNotificationsRealtime();
      if (!vm.user || !vm.user.id) {
        return;
      }
      var client = SupabaseService.client;
      notificationsChannel = client
        .channel("notifications:" + vm.user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + vm.user.id },
          function (payload) {
            var row = payload && payload.new ? payload.new : null;
            if (!row) { return; }
            vm.notifications.unshift(row);
            vm.notifications = vm.notifications.slice(0, 10);
            refreshUnreadCount();
            pushToast(row.title, row.content, row.type);
            vm.isNewNotification = true;
            $timeout(function () {
              vm.isNewNotification = false;
              safeApply();
            }, 5000);
            safeApply();
          }
        )
        .subscribe();
    }

    function teardownNotificationsRealtime() {
      try {
        if (notificationsChannel) {
          SupabaseService.client.removeChannel(notificationsChannel);
        }
      } catch (e) {
        /* ignore */
      }
      notificationsChannel = null;
    }

    function ownsTicket(ticket) {
      if (!vm.user || !vm.user.id || !ticket) {
        return false;
      }
      if (ticket.assigned_to && ticket.assigned_to.id) {
        return ticket.assigned_to.id === vm.user.id;
      }
      return ticket.requester_id === vm.user.id;
    }

    function maybeNotifyCriticalTickets() {
      if (!vm.user || !vm.user.id) {
        return;
      }
      var now = vm.slaNow || vm.now || new Date();
      (vm.tickets || []).forEach(function (t) {
        if (!t || !t.id || !ownsTicket(t)) {
          return;
        }
        var r = TicketService.getRemainingSLA(t, now);
        if (!r) {
          return;
        }
        var isCritical = r.slaState === "critical";
        if (isCritical && !t._criticalNotified) {
          t._criticalNotified = true;
          NotificationService
            .notify(vm.user.id, "SLA crítico", "#" + (t.ticket_code || t.id) + " está com menos de 30 minutos.", "critical")
            .catch(handleError)
            .finally(safeApply);
        } else if (!isCritical && t._criticalNotified) {
          t._criticalNotified = false;
        }
      });
    }

    function ensurePostLoginRoute() {
      return $timeout(function () {
        var path = $location.path() || "/";
        var isRootPath = path === "/" || path === "";
        if (isRootPath) {
          $location.path("/dashboard");
        }
        updateRouteMeta();
      }, 0);
    }

    function loadData() {
      var shouldLoadAllForKpis = vm.isAdmin() || vm.isAgent();
      return $qAll([
        TicketService.fetchCategories(),
        TicketService.fetchTickets({ includeRequesterProfiles: vm.isAdmin() || vm.isAgent() }),
        shouldLoadAllForKpis ? TicketService.fetchTickets({ includeArchived: true }) : $q.when([]),
        QueueService.fetchQueues()
      ]).then(function (all) {
        vm.categories = all[0];
        vm.tickets = filterTicketsByRole(all[1]);
        vm.kpiTickets = shouldLoadAllForKpis ? filterTicketsByRole(all[2]) : vm.tickets;
        vm.queues = all[3];
        vm.newTicket = defaultFormState();
        resetNewTicketForm();
        recompute();
      });
    }

    function loadProfileAndData() {
      return ProfileService.fetchProfile(vm.user.id).then(function (profile) {
        vm.profile = profile;
        if (vm.newTicket && !vm.newTicket.requester_name && vm.profile && vm.profile.full_name) {
          vm.newTicket.requester_name = vm.profile.full_name;
        }
        if (profile && profile.id && profile.full_name) {
          TicketService.rememberProfileName(profile.id, profile.full_name);
        }
        applyRoleFromProfile(profile);
        vm.profileComplete = ProfileService.isProfileComplete();
        if (!vm.profileComplete) {
          $location.path("/complete-profile");
          return;
        }
        return loadData().then(function () {
          return refreshNotifications();
        }).then(function () {
          setupNotificationsRealtime();
        }).then(function () {
          return ensurePostLoginRoute();
        });
      });
    }

    function bootstrapAuth() {
      AuthService.getSession().then(function (session) {
        vm.user = session ? session.user : null;
        if (vm.user) {
          vm.user.role = "user";
        }
        refreshPermissions();
        if (vm.user) { return loadProfileAndData(); }
        vm.message = "Faca login para carregar dados persistentes do Supabase.";
      }).catch(handleError).finally(safeApply);
    }

    function removeTicketFromActiveList(ticketId) {
      vm.tickets = (vm.tickets || []).filter(function (row) {
        return row && row.id !== ticketId;
      });
      vm.kpiTickets = (vm.kpiTickets || []).map(function (row) {
        if (row && row.id === ticketId) {
          row.is_archived = true;
          row.archived_at = row.archived_at || new Date().toISOString();
        }
        return row;
      });
      if (vm.activeTicketId === ticketId) {
        vm.activeTicketId = null;
        vm.comments = [];
        vm.history = [];
      }
    }

    function deleteArchivedTicket(ticket) {
      if (!ticket || !ticket.id) { return; }
      if (!vm.permissions.canDeleteArchived || !vm.isAdmin()) {
        vm.message = "Somente admin pode excluir chamados arquivados definitivamente.";
        pushToast("Sem permissão", vm.message, "warning");
        return;
      }
      if (!ticket.is_archived) {
        vm.message = "Somente chamados arquivados podem ser excluídos por esta ação.";
        pushToast("Ação não permitida", vm.message, "warning");
        return;
      }
      var code = ticket.ticket_code || ticket.id;
      var ok = window.confirm(
        "Excluir definitivamente o chamado " + code + "?\n\n" +
        "Esta ação não poderá ser desfeita. O registro será removido da área Arquivados."
      );
      if (!ok) { return; }
      ticket._busy = true;
      TicketService.deleteArchivedTicket(ticket.id).then(function () {
        vm.archivedTickets = (vm.archivedTickets || []).filter(function (row) {
          return row && row.id !== ticket.id;
        });
        vm.kpiTickets = (vm.kpiTickets || []).filter(function (row) {
          return row && row.id !== ticket.id;
        });
        recompute();
        vm.message = "Chamado arquivado excluído definitivamente.";
        pushToast("Chamado excluído", "O chamado arquivado foi removido definitivamente.", "success");
      }).catch(function (error) {
        console.error("[HelpOn][deleteArchivedTicket] erro ao excluir arquivado:", error);
        vm.message = localizeErrorMessage(error);
        pushToast("Erro ao excluir", vm.message, "error");
      }).finally(function () {
        ticket._busy = false;
        safeApply();
      });
    }

    function loadArchivedTickets() {
      if (!vm.isAdmin() && !vm.isAgent()) {
        vm.archivedTickets = [];
        return $q.when([]);
      }
      if (vm.archivedLoading) {
        return $q.when(vm.archivedTickets || []);
      }
      vm.archivedLoading = true;
      return TicketService.fetchArchivedTickets({ includeRequesterProfiles: true }).then(function (rows) {
        vm.archivedTickets = rows || [];
        return vm.archivedTickets;
      }).catch(function (error) {
        vm.message = localizeErrorMessage(error);
        pushToast("Erro ao carregar arquivados", vm.message, "error");
        vm.archivedTickets = [];
        return [];
      }).finally(function () {
        vm.archivedLoading = false;
        safeApply();
      });
    }

    function filteredArchivedTickets() {
      var query = String(vm.archivedSearch || "").toLowerCase().trim();
      var queue = vm.archivedQueueFilter || "";
      return (vm.archivedTickets || []).filter(function (ticket) {
        if (!ticket) { return false; }
        if (queue && ticket.queue_id !== queue) {
          return false;
        }
        if (!query) {
          return true;
        }
        var haystack = [
          ticket.ticket_code,
          ticket.id,
          ticket.title,
          ticket.description,
          ticket.requester_name,
          ticket.contact_email,
          ticket.category_name,
          ticket.queue_name
        ].join(" ").toLowerCase();
        return haystack.indexOf(query) !== -1;
      });
    }

    function formatDateTime(value) {
      if (!value) {
        return "Não informado";
      }
      var date = new Date(value);
      if (isNaN(date.getTime())) {
        return "Não informado";
      }
      var pad = function (n) {
        var text = String(n);
        return text.length < 2 ? "0" + text : text;
      };
      return pad(date.getDate()) + "/" +
        pad(date.getMonth() + 1) + "/" +
        date.getFullYear() + " " +
        pad(date.getHours()) + ":" +
        pad(date.getMinutes());
    }

    function handleError(error) {
      vm.connectionOk = false;
      var msg = localizeErrorMessage(error);
      pushToast("Erro", msg, "critical");
      vm.message = "Erro: " + msg;
    }

    function refreshLockStatus() {
      vm.authLocked = AuthService.isLocked();
      vm.authLockRemaining = AuthService.getRemainingLockSeconds();
    }

    function currentRole() {
      return (vm.user && vm.user.role) || "user";
    }

    function refreshPermissions() {
      var role = currentRole();
      var selected = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
      vm.permissions = angular.copy(selected);
      vm.visibleStatuses = selected.visibleStatuses.slice();
    }

    function applyRoleFromProfile(profile) {
      if (!vm.user) { return; }
      vm.user.role = (profile && profile.role) || "user";
      refreshPermissions();
      if (($location.path() || "") === "/archived" && vm.isUser()) {
        $location.path("/dashboard");
      } else if (($location.path() || "") === "/archived" && (vm.isAdmin() || vm.isAgent())) {
        loadArchivedTickets();
      }
      updateRouteMeta();
    }

    function filterTicketsByRole(rows) {
      var list = rows || [];
      if (vm.permissions.canSeeAllTickets || !vm.user || !vm.user.id) {
        return list;
      }
      return list.filter(function (ticket) {
        return ticket.requester_id === vm.user.id;
      });
    }

    function safeApply() {
      if (!$scope.$$phase) { $scope.$applyAsync(); }
    }

    function $qAll(promises) {
      return $q.all(promises);
    }

    updateRouteMeta();
    refreshLockStatus();
    bootstrapAuth();

    $scope.$on("$routeChangeSuccess", function () {
      updateRouteMeta();
      if (($location.path() || "") === "/archived") {
        if (!vm.user || !vm.profile) {
          safeApply();
          return;
        }
        if (vm.isUser()) {
          $location.path("/dashboard");
        } else {
          loadArchivedTickets();
        }
      }
      safeApply();
    });

    var nowTick = $interval(function () {
      vm.now = new Date();
      updateRouteMeta();
      refreshLockStatus();
    }, 1000);

    var slaTick = $interval(function () {
      vm.slaNow = new Date();
      maybeNotifyCriticalTickets();
      vm.refreshStats();
      safeApply();
    }, 60000);

    $scope.$on("$destroy", function () {
      if (nowTick) { $interval.cancel(nowTick); }
      if (slaTick) { $interval.cancel(slaTick); }
      teardownNotificationsRealtime();
    });
  }

  function uppercaseOnlyDirective() {
    return {
      require: "ngModel",
      link: function (scope, element, attrs, ctrl) {
        function toUpper(val) {
          return (typeof val === "string") ? val.toUpperCase() : val;
        }
        function applyUpper(viewValue) {
          var transformed = toUpper(viewValue);
          if (transformed !== viewValue) {
            ctrl.$setViewValue(transformed, "input");
            ctrl.$render();
          }
          return transformed;
        }
        ctrl.$parsers.push(function (viewValue) {
          return applyUpper(viewValue);
        });
        ctrl.$formatters.push(function (modelValue) {
          return toUpper(modelValue);
        });
      }
    };
  }

  function restrictPatternDirective() {
    return {
      require: "ngModel",
      link: function (scope, element, attrs, ctrl) {
        var rawPattern = attrs.restrictPattern || "";
        var flags = attrs.restrictFlags || "g";
        var maxLen = attrs.maxLength ? parseInt(attrs.maxLength, 10) : null;
        var pattern;
        try {
          pattern = new RegExp(rawPattern, flags);
        } catch (e) {
          pattern = /[^A-Za-z0-9]/g;
        }

        function sanitize(val) {
          if (!val || typeof val !== "string") { return val; }
          var cleaned = val.replace(pattern, "");
          if (maxLen && cleaned.length > maxLen) {
            cleaned = cleaned.substring(0, maxLen);
          }
          return cleaned;
        }

        function applySanitize(viewValue) {
          var cleaned = sanitize(viewValue);
          if (cleaned !== viewValue) {
            ctrl.$setViewValue(cleaned, "input");
            ctrl.$render();
          }
          return cleaned;
        }

        ctrl.$parsers.push(function (viewValue) {
          return applySanitize(viewValue);
        });

        ctrl.$formatters.push(function (modelValue) {
          return sanitize(modelValue);
        });
      }
    };
  }

  function profileDirective() {
    return {
      restrict: "E",
      scope: {
        profile: "=",
        onSave: "&"
      },
      template:
        "<form class='profile-form' name='profileForm' ng-submit='submit()' novalidate>" +
        "<header class='profile-form-header'>" +
        "<div>" +
        "<h4>Dados do perfil</h4>" +
        "<p>Essas informações ajudam a FlightOn a identificar você e agilizar seus atendimentos.</p>" +
        "<small class='profile-readonly-note' ng-if='!editing'>Modo visualização. Edite somente quando precisar atualizar seus dados.</small>" +
        "<small class='profile-readonly-note' ng-if='editing'>Mantenha seus dados atualizados para que a equipe da FlightOn consiga atender seus chamados com mais agilidade.</small>" +
        "</div>" +
        "<button type='button' class='ghost-btn profile-edit-btn' ng-if='!editing' ng-click='enableEdit()'>Editar dados do perfil</button>" +
        "</header>" +
        "<section class='profile-form-grid'>" +
        "<div class='profile-field'>" +
        "<label for='profile-first-name'>Nome legal</label>" +
        "<input id='profile-first-name' type='text' ng-model='form.legal_first_name' placeholder='Ex: Guilherme' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "<small class='field-hint'>Use o nome conforme documento oficial.</small>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-last-name'>Sobrenome</label>" +
        "<input id='profile-last-name' type='text' ng-model='form.last_name' placeholder='Ex: Silva' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-birth-date'>Data de nascimento</label>" +
        "<input id='profile-birth-date' type='date' ng-model='form.birth_date' min='1900-01-01' ng-attr-max='{{ maxBirthDate }}' ng-disabled='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-document'>Documento</label>" +
        "<input id='profile-document' type='text' ng-model='form.document_number' placeholder='CPF: 12345678900' maxlength='11' inputmode='numeric' autocomplete='off' restrict-pattern='[^0-9]' title='Informe apenas os 11 números do CPF' ng-readonly='!editing' required>" +
        "<small class='field-hint'>Use o documento informado à companhia.</small>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-doc-country'>País emissor do documento</label>" +
        "<select id='profile-doc-country' ng-model='form.document_country_choice' ng-options='country for country in countryOptions' ng-disabled='!editing' required><option value='' disabled>Selecione o país emissor</option></select>" +
        "</div>" +
        "<div class='profile-field' ng-if=\"form.document_country_choice === 'Outro'\">" +
        "<label for='profile-doc-country-other'>Informe o país emissor</label>" +
        "<input id='profile-doc-country-other' type='text' ng-model='form.document_country_other' placeholder='Ex: Japão' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-nationality'>Nacionalidade</label>" +
        "<select id='profile-nationality' ng-model='form.nationality_choice' ng-options='nationality for nationality in nationalityOptions' ng-disabled='!editing' required><option value='' disabled>Selecione sua nacionalidade</option></select>" +
        "</div>" +
        "<div class='profile-field' ng-if=\"form.nationality_choice === 'Outra'\">" +
        "<label for='profile-nationality-other'>Informe sua nacionalidade</label>" +
        "<input id='profile-nationality-other' type='text' ng-model='form.nationality_other' placeholder='Ex: Japonesa' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-gender'>Gênero</label>" +
        "<select id='profile-gender' ng-model='form.gender_choice' ng-options='gender for gender in genderOptions' ng-disabled='!editing' required><option value='' disabled>Selecione o gênero</option></select>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-phone'>Celular</label>" +
        "<input id='profile-phone' type='tel' ng-model='form.phone_number' placeholder='Ex: (11) 99999-9999' maxlength='20' inputmode='tel' autocomplete='tel' restrict-pattern='[^0-9()+\\-\\s]' ng-readonly='!editing' required>" +
        "<small class='field-hint'>Use DDD e número. Ex: (11) 99999-9999.</small>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-country'>País</label>" +
        "<select id='profile-country' ng-model='form.country_choice' ng-options='country for country in countryOptions' ng-disabled='!editing' required><option value='' disabled>Selecione o país</option></select>" +
        "</div>" +
        "<div class='profile-field' ng-if=\"form.country_choice === 'Outro'\">" +
        "<label for='profile-country-other'>Informe o país</label>" +
        "<input id='profile-country-other' type='text' ng-model='form.country_other' placeholder='Ex: Japão' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-state'>Estado</label>" +
        "<input id='profile-state' type='text' ng-model='form.state' placeholder='Ex: São Paulo' maxlength='80' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "<div class='profile-field'>" +
        "<label for='profile-city'>Cidade</label>" +
        "<input id='profile-city' type='text' ng-model='form.city' placeholder='Ex: Guarulhos' maxlength='100' restrict-pattern=\"[^A-Za-zÀ-ÖØ-öø-ÿ'\\-\\s]\" ng-readonly='!editing' required>" +
        "</div>" +
        "</section>" +
        "<section class='profile-form-actions' ng-if='editing'>" +
        "<button type='submit' class='bounce-btn' ng-disabled='saving'>{{ saving ? 'Salvando...' : (isProfileIncomplete ? 'Salvar Perfil' : 'Salvar alterações') }}</button>" +
        "<button type='button' class='ghost-btn' ng-if='!isProfileIncomplete' ng-click='cancelEdit()' ng-disabled='saving'>Cancelar</button>" +
        "</section>" +
        "<p class='profile-form-message' ng-if='profileMessage'>{{ profileMessage }}</p>" +
        "</form>",
      link: function (scope) {
        var countryOptions = ["Brasil", "Argentina", "Chile", "Uruguai", "Paraguai", "Estados Unidos", "Canada", "Mexico", "Portugal", "Espanha", "Franca", "Alemanha", "Italia", "Reino Unido", "Outro"];
        var nationalityOptions = ["Brasileira", "Argentina", "Chilena", "Uruguaia", "Paraguaia", "Americana", "Canadense", "Mexicana", "Portuguesa", "Espanhola", "Francesa", "Alema", "Italiana", "Britanica", "Outra"];
        var genderOptions = ["Masculino", "Feminino"];

        scope.maxBirthDate = new Date().toISOString().slice(0, 10);
        scope.countryOptions = countryOptions;
        scope.nationalityOptions = nationalityOptions;
        scope.genderOptions = genderOptions;
        scope.saving = false;

        function cleanText(value) {
          return String(value || "").trim().replace(/\s+/g, " ");
        }

        function onlyDigits(value) {
          return String(value || "").replace(/\D/g, "");
        }

        function cleanPersonName(value) {
          return cleanText(value).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\-\s]/g, "");
        }

        function cleanPhone(value) {
          return cleanText(value).replace(/[^0-9()+\-\s]/g, "").slice(0, 20);
        }

        function normalizeDateInput(value) {
          if (!value) { return ""; }
          if (value instanceof Date && !isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
          }
          return String(value || "").slice(0, 10);
        }

        function toDateInput(value) {
          var normalized = normalizeDateInput(value);
          if (!normalized) { return null; }
          var date = new Date(normalized + "T00:00:00");
          return isNaN(date.getTime()) ? null : date;
        }

        function hasLetters(value) {
          return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(String(value || ""));
        }

        function isValidPhone(value) {
          var digits = onlyDigits(value);
          var phone = String(value || "");
          var plusIndex = phone.indexOf("+");
          return digits.length >= 10 &&
            digits.length <= 15 &&
            (plusIndex === -1 || plusIndex === 0) &&
            phone.indexOf("+", plusIndex + 1) === -1;
        }

        function isKnownOption(value, options) {
          return options.indexOf(value) !== -1;
        }

        function normalizeGenderChoice(value) {
          var gender = cleanText(value);
          return gender === "Masculino" || gender === "Feminino" ? gender : "";
        }

        function prepareChoice(form, field, choiceField, otherField, options, otherValue) {
          var value = cleanText(form[field]);
          if (!value) {
            form[choiceField] = "";
            form[otherField] = "";
            return;
          }
          if (isKnownOption(value, options) && value !== otherValue) {
            form[choiceField] = value;
            form[otherField] = "";
            return;
          }
          form[choiceField] = otherValue;
          form[otherField] = value === otherValue ? "" : value;
        }

        function prepareProfileChoices() {
          prepareChoice(scope.form, "document_country", "document_country_choice", "document_country_other", countryOptions, "Outro");
          prepareChoice(scope.form, "nationality", "nationality_choice", "nationality_other", nationalityOptions, "Outra");
          prepareChoice(scope.form, "country", "country_choice", "country_other", countryOptions, "Outro");
          scope.form.gender_choice = normalizeGenderChoice(scope.form.gender);
        }

        function sanitizeProfileForm() {
          var form = scope.form || {};
          form.legal_first_name = cleanPersonName(form.legal_first_name).slice(0, 80);
          form.last_name = cleanPersonName(form.last_name).slice(0, 80);
          form.document_number = cleanText(form.document_number).replace(/\D/g, "").slice(0, 11);
          form.document_country_other = cleanPersonName(form.document_country_other).slice(0, 80);
          form.nationality_other = cleanPersonName(form.nationality_other).slice(0, 80);
          form.gender_choice = normalizeGenderChoice(form.gender_choice);
          form.phone_number = cleanPhone(form.phone_number);
          form.country_other = cleanPersonName(form.country_other).slice(0, 80);
          form.state = cleanPersonName(form.state).slice(0, 80);
          form.city = cleanPersonName(form.city).slice(0, 100);
        }

        function buildProfilePayloadForSave() {
          var form = scope.form || {};
          var documentCountry = form.document_country_choice === "Outro" ? cleanText(form.document_country_other) : cleanText(form.document_country_choice);
          var nationality = form.nationality_choice === "Outra" ? cleanText(form.nationality_other) : cleanText(form.nationality_choice);
          var gender = normalizeGenderChoice(form.gender_choice);
          var country = form.country_choice === "Outro" ? cleanText(form.country_other) : cleanText(form.country_choice);
          return {
            legal_first_name: cleanText(form.legal_first_name),
            last_name: cleanText(form.last_name),
            birth_date: normalizeDateInput(form.birth_date),
            document_number: cleanText(form.document_number).replace(/\D/g, "").slice(0, 11),
            document_country: documentCountry,
            nationality: nationality,
            gender: gender,
            phone_number: cleanText(form.phone_number),
            country: country,
            state: cleanText(form.state),
            city: cleanText(form.city),
            role: (scope.originalForm && scope.originalForm.role) || (scope.profile && scope.profile.role) || "user"
          };
        }

        function isProfileFormComplete(profile) {
          var p = profile || {};
          return Boolean(
            cleanText(p.legal_first_name) &&
            cleanText(p.last_name) &&
            normalizeDateInput(p.birth_date) &&
            /^\d{11}$/.test(cleanText(p.document_number)) &&
            cleanText(p.document_country) &&
            cleanText(p.nationality) &&
            (p.gender === "Feminino" || p.gender === "Masculino") &&
            cleanText(p.phone_number) &&
            cleanText(p.country) &&
            cleanText(p.state) &&
            cleanText(p.city)
          );
        }

        function validateProfileForm() {
          var payload = buildProfilePayloadForSave();
          var birthDate = normalizeDateInput(scope.form.birth_date);
          if (!payload.legal_first_name || payload.legal_first_name.length < 2) {
            return { ok: false, message: "Informe o nome legal com pelo menos 2 caracteres." };
          }
          if (!payload.last_name || payload.last_name.length < 2) {
            return { ok: false, message: "Informe o sobrenome com pelo menos 2 caracteres." };
          }
          if (!birthDate || birthDate < "1900-01-01" || birthDate > scope.maxBirthDate) {
            return { ok: false, message: "Informe uma data de nascimento válida." };
          }
          if (!/^\d{11}$/.test(payload.document_number)) {
            return { ok: false, message: "Informe um CPF válido com exatamente 11 números." };
          }
          if (!payload.document_country) {
            return { ok: false, message: "Informe o país emissor do documento." };
          }
          if (!payload.nationality) {
            return { ok: false, message: "Informe a nacionalidade." };
          }
          if (payload.gender !== "Feminino" && payload.gender !== "Masculino") {
            return { ok: false, message: "Selecione uma opção válida de gênero." };
          }
          if (!payload.phone_number || !isValidPhone(payload.phone_number)) {
            return { ok: false, message: "Informe um celular válido com DDD. Ex: (11) 99999-9999." };
          }
          if (!payload.country) {
            return { ok: false, message: "Informe o país." };
          }
          if (!payload.state || !hasLetters(payload.state)) {
            return { ok: false, message: "Informe um estado válido." };
          }
          if (!payload.city || !hasLetters(payload.city)) {
            return { ok: false, message: "Informe uma cidade válida." };
          }
          return { ok: true, payload: payload };
        }

        function refreshForm(profile) {
          scope.originalForm = angular.copy(profile || { role: "user" });
          scope.originalForm.document_number = cleanText(scope.originalForm.document_number).replace(/\D/g, "").slice(0, 11);
          scope.form = angular.copy(scope.originalForm);
          scope.form.birth_date = toDateInput(scope.form.birth_date);
          prepareProfileChoices();
          scope.isProfileIncomplete = !isProfileFormComplete(buildProfilePayloadForSave());
          scope.editing = scope.isProfileIncomplete;
          scope.profileMessage = "";
        }

        scope.enableEdit = function () {
          scope.editing = true;
          scope.profileMessage = "";
        };

        scope.cancelEdit = function () {
          refreshForm(scope.originalForm);
          scope.editing = scope.isProfileIncomplete;
        };

        scope.submit = function () {
          if (!scope.editing || scope.saving) { return; }
          sanitizeProfileForm();
          var validation = validateProfileForm();
          if (!validation.ok) {
            scope.profileMessage = validation.message;
            return;
          }
          scope.profileMessage = "";
          scope.saving = true;
          var result = scope.onSave({ profilePayload: validation.payload });
          if (result && typeof result.then === "function") {
            result.then(function (savedProfile) {
              refreshForm(savedProfile || validation.payload);
              if (scope.isProfileIncomplete) {
                scope.editing = true;
                scope.profileMessage = "Complete os campos obrigatórios para finalizar seu perfil.";
              }
            }).catch(function () {
              scope.profileMessage = "Não foi possível salvar o perfil. Tente novamente.";
            }).finally(function () {
              scope.saving = false;
            });
          } else {
            refreshForm(validation.payload);
            scope.saving = false;
          }
        };

        scope.$watch("profile", function (profile) {
          if (!scope.saving) {
            refreshForm(profile);
          }
        }, true);
      }
    };
  }

  slaBadgeDirective.$inject = ["TicketService"];
  function slaBadgeDirective(TicketService) {
    return {
      restrict: "E",
      scope: { ticket: "=", now: "=" },
      template: "<span class='sla' ng-class='slaState'>{{ remainingLabel }}</span>",
      link: function (scope) {
        scope.$watchGroup(["ticket", "now"], function () {
          if (!scope.ticket || !scope.now) { return; }
          var result = TicketService.getRemainingSLA(scope.ticket, scope.now);
          if (!result) { return; }
          scope.remainingLabel = result.remainingLabel;
          scope.slaState = result.slaState;
        });
      }
    };
  }
})();
