use std::env;

pub struct Flags {
    pub json: bool,
    pub full: bool,
    pub headed: bool,
    pub debug: bool,
    pub session: String,
    pub headers: Option<String>,
}

pub fn parse_flags(args: &[String]) -> Flags {
    let mut flags = Flags {
        json: false,
        full: false,
        headed: false,
        debug: false,
        session: env::var("AGENT_BROWSER_SESSION").unwrap_or_else(|_| "default".to_string()),
        headers: None,
    };

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => flags.json = true,
            "--full" | "-f" => flags.full = true,
            "--headed" => flags.headed = true,
            "--debug" => flags.debug = true,
            "--session" => {
                if let Some(s) = args.get(i + 1) {
                    flags.session = s.clone();
                    i += 1;
                }
            }
            "--headers" => {
                if let Some(h) = args.get(i + 1) {
                    flags.headers = Some(h.clone());
                    i += 1;
                }
            }
            _ => {}
        }
        i += 1;
    }
    flags
}

pub fn clean_args(args: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    let mut skip_next = false;

    // Global flags that should be stripped from command args
    const GLOBAL_FLAGS: &[&str] = &["--json", "--full", "--headed", "--debug"];
    // Global flags that take a value (need to skip the next arg too)
    const GLOBAL_FLAGS_WITH_VALUE: &[&str] = &["--session", "--headers"];

    for arg in args.iter() {
        if skip_next {
            skip_next = false;
            continue;
        }
        if GLOBAL_FLAGS_WITH_VALUE.contains(&arg.as_str()) {
            skip_next = true;
            continue;
        }
        // Only strip known global flags, not command-specific flags
        if GLOBAL_FLAGS.contains(&arg.as_str()) || arg == "-f" {
            continue;
        }
        result.push(arg.clone());
    }
    result
}
