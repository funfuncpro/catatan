defmodule CatatanBackendWeb.Email.VerifyController do
  use CatatanBackendWeb, :controller

  alias CatatanBackendWeb.Response
  alias CatatanBackend.Email
  alias CatatanBackendWeb.Validators.Email, as: EmailValidator

  action_fallback CatatanBackendWeb.FallbackController

  def create(conn, params) do
    case EmailValidator.validate_registration_email(params) do
      {:ok, validated_data} ->
        case Email.send_registration_confirmation(%{
               email: validated_data.email,
               verification_code: validated_data.verification_code
             }) do
          :ok ->
            conn
            |> put_status(:ok)
            |> Response.success_response("Email verification sent successfully", %{})

          {:error, _reason} ->
            conn
            |> put_status(:service_unavailable)
            |> Response.error_response(
              "Service Unavailable",
              "Failed to send email, please try again later"
            )
        end

      {:error, errors} ->
        conn
        |> put_status(:bad_request)
        |> Response.error_response("Bad Request", errors)
    end
  end
end
