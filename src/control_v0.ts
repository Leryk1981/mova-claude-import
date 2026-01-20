import { MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";

export type ControlV0 = {
  version: "control_v0";
  claude_md: {
    inject_control_entry: boolean;
    marker: string;
  };
  overlay: {
    enable: boolean;
  };
  mcp: {
    servers: any;
  };
  policy: {
    mode: string;
    hooks: {
      enable: boolean;
      on_invalid_hook: string;
      definitions: any[];
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
    };
  };
};

function isObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function defaultControlV0(): ControlV0 {
  return {
    version: "control_v0",
    claude_md: {
      inject_control_entry: true,
      marker: MOVA_CONTROL_ENTRY_MARKER,
    },
    overlay: {
      enable: true,
    },
    mcp: {
      servers: [],
    },
    policy: {
      mode: "report_only",
      hooks: {
        enable: true,
        on_invalid_hook: "report_only",
        definitions: [],
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
      },
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

function coerceArray(value: any, fallback: any[], defaults: string[], path: string): any[] {
  if (Array.isArray(value)) return value;
  defaults.push(path);
  return fallback;
}

function coerceServers(value: any, fallback: any, defaults: string[], path: string): any {
  if (Array.isArray(value)) return value;
  if (isObject(value)) return value;
  defaults.push(path);
  return fallback;
}

export function normalizeControlV0(input: any): { control: ControlV0; defaults: string[] } {
  const defaults: string[] = [];
  const base = defaultControlV0();
  const src = isObject(input) ? input : {};

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

  base.overlay.enable = coerceBoolean(src?.overlay?.enable, base.overlay.enable, defaults, "overlay.enable");

  base.mcp.servers = coerceServers(src?.mcp?.servers, base.mcp.servers, defaults, "mcp.servers");

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

  return { control: base, defaults };
}

export function controlFromSettingsV0(
  settings: any | undefined,
  mcp: any | undefined
): { control: ControlV0; defaults: string[] } {
  const defaults: string[] = [];
  const base = defaultControlV0();

  if (!settings) {
    defaults.push("policy", "claude_md");
  } else {
    base.policy.hooks.enable = coerceBoolean(
      settings?.hooks?.enable,
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
    base.policy.permissions.on_conflict = coerceString(
      settings?.permissions?.behavior?.on_conflict,
      base.policy.permissions.on_conflict,
      defaults,
      "policy.permissions.on_conflict"
    );
    base.policy.permissions.on_unknown = coerceString(
      settings?.permissions?.behavior?.on_unknown,
      base.policy.permissions.on_unknown,
      defaults,
      "policy.permissions.on_unknown"
    );

    base.policy.plugins.enable = coerceBoolean(
      settings?.plugins?.enable,
      base.policy.plugins.enable,
      defaults,
      "policy.plugins.enable"
    );
    base.policy.plugins.allowed_plugin_ids = coerceArray(
      settings?.plugins?.allowed_plugin_ids,
      base.policy.plugins.allowed_plugin_ids,
      defaults,
      "policy.plugins.allowed_plugin_ids"
    );
    base.policy.plugins.denied_plugin_ids = coerceArray(
      settings?.plugins?.denied_plugin_ids,
      base.policy.plugins.denied_plugin_ids,
      defaults,
      "policy.plugins.denied_plugin_ids"
    );
    base.policy.plugins.on_unknown = coerceString(
      settings?.plugins?.behavior?.on_unknown,
      base.policy.plugins.on_unknown,
      defaults,
      "policy.plugins.on_unknown"
    );
  }

  if (!mcp) {
    defaults.push("mcp.servers");
  } else {
    base.mcp.servers = coerceServers(mcp?.servers, base.mcp.servers, defaults, "mcp.servers");
  }

  return { control: base, defaults };
}

export function controlToSettingsV0(control: ControlV0) {
  return {
    profile_version: "v0",
    permissions: {
      allow: control.policy.permissions.allow,
      deny: control.policy.permissions.deny,
      behavior: {
        on_conflict: control.policy.permissions.on_conflict,
        on_unknown: control.policy.permissions.on_unknown,
      },
    },
    plugins: {
      enable: control.policy.plugins.enable,
      allowed_plugin_ids: control.policy.plugins.allowed_plugin_ids,
      denied_plugin_ids: control.policy.plugins.denied_plugin_ids,
      behavior: {
        on_unknown: control.policy.plugins.on_unknown,
      },
    },
    hooks: {
      enable: control.policy.hooks.enable,
      definitions: control.policy.hooks.definitions,
      behavior: {
        on_invalid_hook: control.policy.hooks.on_invalid_hook,
      },
    },
    claude_md: {
      inject_control_entry: control.claude_md.inject_control_entry,
      marker: control.claude_md.marker,
    },
  };
}
