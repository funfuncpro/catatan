defmodule CatatanBackendWeb.Validators.Email do
  @moduledoc """
  Provides email validation functionality.
  """
  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @spec validate_registration_email(map) :: {:ok, map} | {:error, atom()}
  def validate_registration_email(params) do
    types = %{
      email: :string,
      verification_code: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:email, :verification_code])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+\.[^\s]+$/, message: "must be a valid email")
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end
end
