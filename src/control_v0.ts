import { MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";

export const CONTROL_V0_SCHEMA_ID = "https://mova.dev/schemas/mova.control_v0.schema.json";

export type AssetMode = "copy_through" | "managed";

export type AssetItem = {
  path: string;
  mode: AssetMode;
  source_path?: string;
};

export type ControlV0 = {
  $schema?: string;
  version: "control_v0";
  claude_md: {
    inject_control_entry: boolean;
    marker: string;
    priority_sources: string[];
  };
  claude_memory: {
    enable: boolean;
    sources: string[];
  };
  overlay: {
    enable: boolean;
  };
  settings: {
    include_co_authored_by: boolean;
    env: Record<string, string>;
  };
  mcp: {
    servers: any;
    enable_all_project_mcp_servers: boolean;
    enabled_mcpjson_servers: string[];
    env_substitutions: {
      format: string;
      default_format: string;
    };
  };
  policy: {
    mode: string;
    hooks: {
      enable: boolean;
      on_invalid_hook: string;
      definitions: any[];
      events: Record<string, any>;
    };
    permissions: {
      allow: any[];
      deny: any[];
      on_conflict: string;
      on_unknown: string;
    };
    plugins: {
      enable: boolean;
      allowed_plugin_ids: any[];
      denied_plugin_ids: any[];
      on_unknown: string;
      enabled_plugins: Record<string, boolean>;
    };
  };
  lsp: {
    enabled_plugins: string[];
    config_path: string;
    managed: boolean;
  };
  skill_eval: {
    enable: boolean;
    hooks: {
      shell: string;
      node: string;
    };
    rules_path: string;
    scoring: {
      threshold: number;
    };
  };
  observability: {
    enable: boolean;
    mode: string;
    writer: {
      type: "node";
      script_path: string;
    };
    output_dir: string;
    stdout_tail_bytes: number;
    stderr_tail_bytes: number;
    max_event_bytes: number;
    tail_lines: number;
    include_tools: string[];
    include_events: string[];
  };
  assets: {
    skills: AssetItem[];
    agents: AssetItem[];
    commands: AssetItem[];
    rules: AssetItem[];
    hooks: AssetItem[];
    workflows: AssetItem[];
    docs: AssetItem[];
    dotfiles: AssetItem[];
    schemas: AssetItem[];
  };
};

function isObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function defaultControlV0(): ControlV0 {
  return {
    $schema: CONTROL_V0_SCHEMA_ID,
    version: "control_v0",
    claude_md: {
      inject_control_entry: true,
      marker: MOVA_CONTROL_ENTRY_MARKER,
      priority_sources: ["CLAUDE.md", ".claude/CLAUDE.md", "~/.claude/CLAUDE.md"],
    },
    claude_memory: {
      enable: true,
      sources: ["CLAUDE.md"],
    },
    overlay: {
      enable: true,
    },
    settings: {
      include_co_authored_by: true,
      env: {},
    },
    mcp: {
      servers: {},
      enable_all_project_mcp_servers: false,
      enabled_mcpjson_servers: [],
      env_substitutions: {
        format: "${VAR}",
        default_format: "${VAR:-default}",
      },
    },
    policy: {
      mode: "report_only",
      hooks: {
        enable: true,
        on_invalid_hook: "report_only",
        definitions: [],
        events: {},
      },
      permissions: {
        allow: [],
        deny: [],
        on_conflict: "deny_wins",
        on_unknown: "report_only",
      },
      plugins: {
        enable: true,
        allowed_plugin_ids: [],
        denied_plugin_ids: [],
        on_unknown: "report_only",
        enabled_plugins: {},
      },
    },
    lsp: {
      enabled_plugins: [],
      config_path: ".claude/lsp.json",
      managed: false,
    },
    skill_eval: {
      enable: false,
      hooks: {
        shell: ".claude/hooks/skill-eval.sh",
        node: ".claude/hooks/skill-eval.js",
      },
      rules_path: ".claude/hooks/skill-rules.json",
      scoring: {
        threshold: 0.6,
      },
    },
    observability: {
      enable: true,
      mode: "report_only",
      writer: {
        type: "node",
        script_path: ".claude/hooks/mova-observe.js",
      },
      output_dir: ".mova/episodes",
      stdout_tail_bytes: 4000,
      stderr_tail_bytes: 4000,
      max_event_bytes: 20000,
      tail_lines: 50,
      include_tools: ["Bash", "Read", "Edit", "MultiEdit", "Write"],
      include_events: ["PostToolUse", "UserPromptSubmit", "Stop"],
    },
    assets: {
      skills: [],
      agents: [],
      commands: [],
      rules: [],
      hooks: [],
      workflows: [],
      docs: [],
      dotfiles: [],
      schemas: [],
    },
  };
}

function coerceBoolean(value: any, fallback: boolean, defaults: string[], path: string): boolean {
  if (typeof value === "boolean") return value;
  defaults.push(path);
  return fallback;
}

function coerceString(value: any, fallback: string, defaults: string[], path: string): string {
  if (typeof value === "string") return value;
  defaults.push(path);
  return fallback;
}

function coerceNumber(value: any, fallback: number, defaults: string[], path: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  defaults.push(path);
  return fallback;
}

function coerceArray(value: any, fallback: any[], defaults: string[], path: string): any[] {
  if (Array.isArray(value)) return value;
  defaults.push(path);
  return fallback;
}

function coerceRecord(value: any, fallback: Record<string, any>, defaults: string[], path: string): Record<string, any> {
  if (isObject(value)) return value;
  defaults.push(path);
  return fallback;
}

function coerceServers(value: any, fallback: any, defaults: string[], path: string): any {
  if (Array.isArray(value)) return value;
  if (isObject(value)) return value;
  defaults.push(path);
  return fallback;
}

function normalizeAssets(
  value: any,
  fallback: AssetItem[],
  defaults: string[],
  path: string
): AssetItem[] {
  if (!Array.isArray(value)) {
    defaults.push(path);
    return fallback;
  }
  const normalized: AssetItem[] = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.path !== "string") continue;
    const mode = item.mode === "managed" ? "managed" : "copy_through";
    const entry: AssetItem = { path: item.path, mode };
    if (typeof item.source_path === "string") entry.source_path = item.source_path;
    normalized.push(entry);
  }
  return normalized.sort((a, b) => a.path.localeCompare(b.path));
}

export function normalizeControlV0(input: any): { control: ControlV0; defaults: string[] } {
  const defaults: string[] = [];
  const base = defaultControlV0();
  const src = isObject(input) ? input : {};

  base.$schema = CONTROL_V0_SCHEMA_ID;
  base.version = "control_v0";

  base.claude_md.inject_control_entry = coerceBoolean(
    src?.claude_md?.inject_control_entry,
    base.claude_md.inject_control_entry,
    defaults,
    "claude_md.inject_control_entry"
  );
  base.claude_md.marker = coerceString(
    src?.claude_md?.marker,
    base.claude_md.marker,
    defaults,
    "claude_md.marker"
  );
  base.claude_md.priority_sources = coerceArray(
    src?.claude_md?.priority_sources,
    base.claude_md.priority_sources,
    defaults,
    "claude_md.priority_sources"
  );

  base.claude_memory.enable = coerceBoolean(
    src?.claude_memory?.enable,
    base.claude_memory.enable,
    defaults,
    "claude_memory.enable"
  );
  base.claude_memory.sources = coerceArray(
    src?.claude_memory?.sources,
    base.claude_memory.sources,
    defaults,
    "claude_memory.sources"
  );

  base.overlay.enable = coerceBoolean(src?.overlay?.enable, base.overlay.enable, defaults, "overlay.enable");

  base.settings.include_co_authored_by = coerceBoolean(
    src?.settings?.include_co_authored_by,
    base.settings.include_co_authored_by,
    defaults,
    "settings.include_co_authored_by"
  );
  base.settings.env = coerceRecord(src?.settings?.env, base.settings.env, defaults, "settings.env");

  base.mcp.servers = coerceServers(src?.mcp?.servers, base.mcp.servers, defaults, "mcp.servers");
  base.mcp.enable_all_project_mcp_servers = coerceBoolean(
    src?.mcp?.enable_all_project_mcp_servers,
    base.mcp.enable_all_project_mcp_servers,
    defaults,
    "mcp.enable_all_project_mcp_servers"
  );
  base.mcp.enabled_mcpjson_servers = coerceArray(
    src?.mcp?.enabled_mcpjson_servers,
    base.mcp.enabled_mcpjson_servers,
    defaults,
    "mcp.enabled_mcpjson_servers"
  );
  base.mcp.env_substitutions = coerceRecord(
    src?.mcp?.env_substitutions,
    base.mcp.env_substitutions,
    defaults,
    "mcp.env_substitutions"
  ) as ControlV0["mcp"]["env_substitutions"];
  base.mcp.env_substitutions.format = coerceString(
    base.mcp.env_substitutions.format,
    "${VAR}",
    defaults,
    "mcp.env_substitutions.format"
  );
  base.mcp.env_substitutions.default_format = coerceString(
    base.mcp.env_substitutions.default_format,
    "${VAR:-default}",
    defaults,
    "mcp.env_substitutions.default_format"
  );

  base.policy.mode = coerceString(src?.policy?.mode, base.policy.mode, defaults, "policy.mode");
  base.policy.hooks.enable = coerceBoolean(
    src?.policy?.hooks?.enable,
    base.policy.hooks.enable,
    defaults,
    "policy.hooks.enable"
  );
  base.policy.hooks.on_invalid_hook = coerceString(
    src?.policy?.hooks?.on_invalid_hook,
    base.policy.hooks.on_invalid_hook,
    defaults,
    "policy.hooks.on_invalid_hook"
  );
  base.policy.hooks.definitions = coerceArray(
    src?.policy?.hooks?.definitions,
    base.policy.hooks.definitions,
    defaults,
    "policy.hooks.definitions"
  );
  base.policy.hooks.events = coerceRecord(
    src?.policy?.hooks?.events,
    base.policy.hooks.events,
    defaults,
    "policy.hooks.events"
  );

  base.policy.permissions.allow = coerceArray(
    src?.policy?.permissions?.allow,
    base.policy.permissions.allow,
    defaults,
    "policy.permissions.allow"
  );
  base.policy.permissions.deny = coerceArray(
    src?.policy?.permissions?.deny,
    base.policy.permissions.deny,
    defaults,
    "policy.permissions.deny"
  );
  base.policy.permissions.on_conflict = coerceString(
    src?.policy?.permissions?.on_conflict,
    base.policy.permissions.on_conflict,
    defaults,
    "policy.permissions.on_conflict"
  );
  base.policy.permissions.on_unknown = coerceString(
    src?.policy?.permissions?.on_unknown,
    base.policy.permissions.on_unknown,
    defaults,
    "policy.permissions.on_unknown"
  );

  base.policy.plugins.enable = coerceBoolean(
    src?.policy?.plugins?.enable,
    base.policy.plugins.enable,
    defaults,
    "policy.plugins.enable"
  );
  base.policy.plugins.allowed_plugin_ids = coerceArray(
    src?.policy?.plugins?.allowed_plugin_ids,
    base.policy.plugins.allowed_plugin_ids,
    defaults,
    "policy.plugins.allowed_plugin_ids"
  );
  base.policy.plugins.denied_plugin_ids = coerceArray(
    src?.policy?.plugins?.denied_plugin_ids,
    base.policy.plugins.denied_plugin_ids,
    defaults,
    "policy.plugins.denied_plugin_ids"
  );
  base.policy.plugins.on_unknown = coerceString(
    src?.policy?.plugins?.on_unknown,
    base.policy.plugins.on_unknown,
    defaults,
    "policy.plugins.on_unknown"
  );
  base.policy.plugins.enabled_plugins = coerceRecord(
    src?.policy?.plugins?.enabled_plugins,
    base.policy.plugins.enabled_plugins,
    defaults,
    "policy.plugins.enabled_plugins"
  );

  base.lsp.enabled_plugins = coerceArray(
    src?.lsp?.enabled_plugins,
    base.lsp.enabled_plugins,
    defaults,
    "lsp.enabled_plugins"
  );
  base.lsp.config_path = coerceString(
    src?.lsp?.config_path,
    base.lsp.config_path,
    defaults,
    "lsp.config_path"
  );
  base.lsp.managed = coerceBoolean(src?.lsp?.managed, base.lsp.managed, defaults, "lsp.managed");

  base.skill_eval.enable = coerceBoolean(
    src?.skill_eval?.enable,
    base.skill_eval.enable,
    defaults,
    "skill_eval.enable"
  );
  base.skill_eval.hooks = coerceRecord(
    src?.skill_eval?.hooks,
    base.skill_eval.hooks,
    defaults,
    "skill_eval.hooks"
  ) as ControlV0["skill_eval"]["hooks"];
  base.skill_eval.hooks.shell = coerceString(
    base.skill_eval.hooks.shell,
    defaultControlV0().skill_eval.hooks.shell,
    defaults,
    "skill_eval.hooks.shell"
  );
  base.skill_eval.hooks.node = coerceString(
    base.skill_eval.hooks.node,
    defaultControlV0().skill_eval.hooks.node,
    defaults,
    "skill_eval.hooks.node"
  );
  base.skill_eval.rules_path = coerceString(
    src?.skill_eval?.rules_path,
    base.skill_eval.rules_path,
    defaults,
    "skill_eval.rules_path"
  );
  base.skill_eval.scoring = coerceRecord(
    src?.skill_eval?.scoring,
    base.skill_eval.scoring,
    defaults,
    "skill_eval.scoring"
  ) as ControlV0["skill_eval"]["scoring"];
  base.skill_eval.scoring.threshold = coerceNumber(
    base.skill_eval.scoring.threshold,
    defaultControlV0().skill_eval.scoring.threshold,
    defaults,
    "skill_eval.scoring.threshold"
  );

  base.observability.enable = coerceBoolean(
    src?.observability?.enable,
    base.observability.enable,
    defaults,
    "observability.enable"
  );
  base.observability.mode = coerceString(
    src?.observability?.mode,
    base.observability.mode,
    defaults,
    "observability.mode"
  );
  base.observability.writer = coerceRecord(
    src?.observability?.writer,
    base.observability.writer,
    defaults,
    "observability.writer"
  ) as ControlV0["observability"]["writer"];
  base.observability.writer.type = "node";
  base.observability.writer.script_path = coerceString(
    base.observability.writer.script_path,
    defaultControlV0().observability.writer.script_path,
    defaults,
    "observability.writer.script_path"
  );
  base.observability.output_dir = coerceString(
    src?.observability?.output_dir,
    base.observability.output_dir,
    defaults,
    "observability.output_dir"
  );
  base.observability.stdout_tail_bytes = coerceNumber(
    src?.observability?.stdout_tail_bytes,
    base.observability.stdout_tail_bytes,
    defaults,
    "observability.stdout_tail_bytes"
  );
  base.observability.stderr_tail_bytes = coerceNumber(
    src?.observability?.stderr_tail_bytes,
    base.observability.stderr_tail_bytes,
    defaults,
    "observability.stderr_tail_bytes"
  );
  base.observability.max_event_bytes = coerceNumber(
    src?.observability?.max_event_bytes,
    base.observability.max_event_bytes,
    defaults,
    "observability.max_event_bytes"
  );
  base.observability.tail_lines = coerceNumber(
    src?.observability?.tail_lines,
    base.observability.tail_lines,
    defaults,
    "observability.tail_lines"
  );
  base.observability.include_tools = coerceArray(
    src?.observability?.include_tools,
    base.observability.include_tools,
    defaults,
    "observability.include_tools"
  );
  base.observability.include_events = coerceArray(
    src?.observability?.include_events,
    base.observability.include_events,
    defaults,
    "observability.include_events"
  );

  base.assets.skills = normalizeAssets(src?.assets?.skills, base.assets.skills, defaults, "assets.skills");
  base.assets.agents = normalizeAssets(src?.assets?.agents, base.assets.agents, defaults, "assets.agents");
  base.assets.commands = normalizeAssets(src?.assets?.commands, base.assets.commands, defaults, "assets.commands");
  base.assets.rules = normalizeAssets(src?.assets?.rules, base.assets.rules, defaults, "assets.rules");
  base.assets.hooks = normalizeAssets(src?.assets?.hooks, base.assets.hooks, defaults, "assets.hooks");
  base.assets.workflows = normalizeAssets(src?.assets?.workflows, base.assets.workflows, defaults, "assets.workflows");
  base.assets.docs = normalizeAssets(src?.assets?.docs, base.assets.docs, defaults, "assets.docs");
  base.assets.dotfiles = normalizeAssets(src?.assets?.dotfiles, base.assets.dotfiles, defaults, "assets.dotfiles");
  base.assets.schemas = normalizeAssets(src?.assets?.schemas, base.assets.schemas, defaults, "assets.schemas");

  return { control: base, defaults };
}

export function controlFromSettingsV0(
  settings: any | undefined,
  mcp: any | undefined
): { control: ControlV0; defaults: string[] } {
  const defaults: string[] = [];
  const base = defaultControlV0();

  if (!settings) {
    defaults.push("settings", "policy", "claude_md");
  } else {
    base.settings.include_co_authored_by = coerceBoolean(
      settings?.includeCoAuthoredBy,
      base.settings.include_co_authored_by,
      defaults,
      "settings.include_co_authored_by"
    );
    base.settings.env = coerceRecord(settings?.env, base.settings.env, defaults, "settings.env");

    base.policy.hooks.enable = coerceBoolean(
      settings?.hooks?.enable ?? true,
      base.policy.hooks.enable,
      defaults,
      "policy.hooks.enable"
    );
    base.policy.hooks.on_invalid_hook = coerceString(
      settings?.hooks?.behavior?.on_invalid_hook,
      base.policy.hooks.on_invalid_hook,
      defaults,
      "policy.hooks.on_invalid_hook"
    );
    base.policy.hooks.definitions = coerceArray(
      settings?.hooks?.definitions,
      base.policy.hooks.definitions,
      defaults,
      "policy.hooks.definitions"
    );
    const events: Record<string, any> = {};
    if (isObject(settings?.hooks)) {
      for (const [key, value] of Object.entries(settings.hooks)) {
        if (key === "enable" || key === "behavior" || key === "definitions") continue;
        events[key] = value;
      }
    }
    base.policy.hooks.events = events;

    base.policy.permissions.allow = coerceArray(
      settings?.permissions?.allow,
      base.policy.permissions.allow,
      defaults,
      "policy.permissions.allow"
    );
    base.policy.permissions.deny = coerceArray(
      settings?.permissions?.deny,
      base.policy.permissions.deny,
      defaults,
      "policy.permissions.deny"
    );
    const defaultMode = settings?.permissions?.defaultMode;
    if (defaultMode === "bypassPermissions" || defaultMode === "dontAsk") {
      base.policy.permissions.on_unknown = "allow";
    } else if (defaultMode === "plan") {
      base.policy.permissions.on_unknown = "deny";
    } else if (defaultMode === "acceptEdits" || defaultMode === "default" || defaultMode === "delegate") {
      base.policy.permissions.on_unknown = "report_only";
    }

    base.policy.plugins.enabled_plugins = coerceRecord(
      settings?.enabledPlugins,
      base.policy.plugins.enabled_plugins,
      defaults,
      "policy.plugins.enabled_plugins"
    );

    base.mcp.enable_all_project_mcp_servers = coerceBoolean(
      settings?.mcp?.enableAllProjectMcpServers,
      base.mcp.enable_all_project_mcp_servers,
      defaults,
      "mcp.enable_all_project_mcp_servers"
    );
    base.mcp.enabled_mcpjson_servers = coerceArray(
      settings?.mcp?.enabledMcpjsonServers,
      base.mcp.enabled_mcpjson_servers,
      defaults,
      "mcp.enabled_mcpjson_servers"
    );

    base.lsp.enabled_plugins = coerceArray(
      settings?.lsp?.enabledPlugins,
      base.lsp.enabled_plugins,
      defaults,
      "lsp.enabled_plugins"
    );
  }

  if (!mcp) {
    defaults.push("mcp.servers");
  } else if (isObject(mcp) && isObject(mcp.mcpServers)) {
    base.mcp.servers = mcp.mcpServers;
  } else {
    base.mcp.servers = coerceServers(mcp?.servers, base.mcp.servers, defaults, "mcp.servers");
  }

  return { control: base, defaults };
}

export function controlToSettingsV0(control: ControlV0) {
  const hooks = {} as Record<string, any>;

  for (const [event, value] of Object.entries(control.policy.hooks.events)) {
    hooks[event] = value;
  }

  if (control.observability.enable && Array.isArray(control.observability.include_events)) {
    const scriptRel = control.observability.writer.script_path.replace(/^[\\/]+/, "");
    const baseCommand = `node \"$CLAUDE_PROJECT_DIR/${scriptRel}\"`;
    const commonArgs = [
      `--stdout-tail-bytes ${control.observability.stdout_tail_bytes}`,
      `--stderr-tail-bytes ${control.observability.stderr_tail_bytes}`,
      `--max-event-bytes ${control.observability.max_event_bytes}`,
      `--tail-lines ${control.observability.tail_lines}`,
      `--output-dir ${control.observability.output_dir}`,
    ].join(" ");
    const postMatcher = control.observability.include_tools.length
      ? control.observability.include_tools.join("|")
      : undefined;

    const ensureEventHook = (event: string, matcher?: string) => {
      const entry: any = {
        hooks: [
          {
            type: "command",
            command: `${baseCommand} --event ${event} ${commonArgs}`.trim(),
            timeout: 5,
          },
        ],
      };
      if (matcher) entry.matcher = matcher;
      hooks[event] = Array.isArray(hooks[event]) ? [...hooks[event], entry] : [entry];
    };

    if (control.observability.include_events.includes("PostToolUse")) {
      ensureEventHook("PostToolUse", postMatcher);
    }
    if (control.observability.include_events.includes("UserPromptSubmit")) {
      ensureEventHook("UserPromptSubmit");
    }
    if (control.observability.include_events.includes("Stop")) {
      ensureEventHook("Stop");
    }
  }

  const settings: Record<string, any> = {
    includeCoAuthoredBy: control.settings.include_co_authored_by,
  };

  if (isObject(control.settings.env) && Object.keys(control.settings.env).length > 0) {
    settings.env = control.settings.env;
  }

  if (Object.keys(hooks).length > 0) {
    settings.hooks = hooks;
  }

  const permissions: Record<string, any> = {};
  if (Array.isArray(control.policy.permissions.allow) && control.policy.permissions.allow.length > 0) {
    permissions.allow = control.policy.permissions.allow;
  }
  if (Array.isArray(control.policy.permissions.deny) && control.policy.permissions.deny.length > 0) {
    permissions.deny = control.policy.permissions.deny;
  }
  if (control.policy.permissions.on_unknown === "allow") {
    permissions.defaultMode = "bypassPermissions";
  } else if (control.policy.permissions.on_unknown === "deny") {
    permissions.defaultMode = "plan";
  } else {
    permissions.defaultMode = "acceptEdits";
  }
  if (Object.keys(permissions).length > 0) {
    settings.permissions = permissions;
  }

  if (control.mcp.enable_all_project_mcp_servers || control.mcp.enabled_mcpjson_servers.length > 0) {
    settings.mcp = {
      enableAllProjectMcpServers: control.mcp.enable_all_project_mcp_servers,
      enabledMcpjsonServers: control.mcp.enabled_mcpjson_servers,
    };
  }

  if (isObject(control.policy.plugins.enabled_plugins) && Object.keys(control.policy.plugins.enabled_plugins).length > 0) {
    settings.enabledPlugins = control.policy.plugins.enabled_plugins;
  }

  return settings;
}

export function controlToMcpJson(control: ControlV0) {
  if (Array.isArray(control.mcp.servers)) {
    return { servers: control.mcp.servers };
  }
  if (isObject(control.mcp.servers)) {
    return { mcpServers: control.mcp.servers };
  }
  return { servers: [] };
}
