from python.helpers.extension import Extension


class UseBrowserModel(Extension):
    """Swap chat_model with browser_model for browser subordinate agents.

    When a browser subordinate is spawned it inherits the parent's full
    AgentConfig including the dedicated ``browser_model`` settings.
    This extension replaces the subordinate's ``chat_model`` with
    ``browser_model`` so the browser agent uses the model explicitly
    configured for browser tasks in the settings UI.

    Runs at priority 10 (before _15_load_profile_settings) so that
    any profile-level settings.json overrides still take effect.
    """

    async def execute(self, **kwargs) -> None:
        if not self.agent:
            return

        config = self.agent.config
        browser_model = getattr(config, "browser_model", None)

        # Only swap if browser_model is actually configured
        if browser_model and browser_model.name:
            config.chat_model = browser_model
            self.agent.context.log.log(
                type="info",
                content=(
                    f"Browser agent {self.agent.number}: using browser_model "
                    f"'{browser_model.provider}/{browser_model.name}' as chat_model."
                ),
            )
