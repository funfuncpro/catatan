defmodule CatatanBackendWeb.SharesValidator do
  @moduledoc """
  Validator module for share-related requests.
  """

  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a share link.
  Expects a map with required :note_id, :access_type, and :allowed_emails keys.
  Expects a map with required :note_id, :access_type, and :allowed_emails keys.
  """
  @spec validate_share_creation(map) :: {:ok, map} | {:error, keyword()}
  def validate_share_creation(params) do
    types = %{
      note_id: :string,
      access_type: :string,
      permission_level: :string,
      allowed_emails: {:array, :string}
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:note_id, :access_type, :allowed_emails])
    |> validate_required([:note_id, :access_type, :allowed_emails])
    |> validate_length(:note_id, min: 1)
    |> validate_inclusion(:access_type, ["public", "restricted"])
    |> validate_inclusion(:permission_level, ["read", "write"])
    |> put_default_permission_level()
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  # Helper function to set default permission_level if not provided
  defp put_default_permission_level(changeset) do
    if get_field(changeset, :permission_level) == nil do
      put_change(changeset, :permission_level, "read")
    else
      changeset
    end
  end

  @doc """
  Validates the parameters for retrieving a shared note.
  Expects a map with a required :share_id key.
  """
  @spec validate_share_retrieval(map) :: {:ok, map} | {:error, keyword()}
  def validate_share_retrieval(params) do
    types = %{
      share_id: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:share_id])
    |> validate_length(:share_id, min: 1)
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end
end
