defmodule CatatanBackend.Email.Templates do
  @moduledoc false

  alias CatatanBackend.Template.Registration.Template, as: RegistrationTemplate
  alias Phoenix.HTML.Safe

  @type template_type :: :registration | String.t()
  @type assigns_map :: map()
  @type rendered_email :: %{html: String.t(), text: String.t()}

  @spec render(template_type(), assigns_map()) ::
          {:ok, rendered_email()} | {:error, term()}
  def render(:registration, assigns), do: render_registration(assigns)
  def render(type, _assigns), do: {:error, {:unsupported_template, type}}

  defp render_registration(assigns) do
    with {:ok, verification_code} <- fetch_verification_code(assigns) do
      template_assigns = %{verification_code: verification_code}

      html =
        template_assigns
        |> RegistrationTemplate.render_html()
        |> Safe.to_iodata()
        |> IO.iodata_to_binary()

      text =
        template_assigns
        |> RegistrationTemplate.render_text()
        |> Safe.to_iodata()
        |> IO.iodata_to_binary()

      {:ok, %{html: html, text: text}}
    end
  end

  defp fetch_verification_code(%{verification_code: code}) when is_binary(code),
    do: {:ok, String.trim(code)}

  defp fetch_verification_code(_assigns),
    do: {:error, {:invalid_assigns, :verification_code}}
end
