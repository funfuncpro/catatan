defmodule CatatanBackendWeb.SharesValidator do
  @moduledoc """
  Validator module for share-related requests.
  """

  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a share link.
  Expects a map with a required :note_id key.
  """
  @spec validate_share_creation(map) :: {:ok, map} | {:error, keyword()}
  def validate_share_creation(params) do
    types = %{
      note_id: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:note_id])
    |> validate_length(:note_id, min: 1)
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
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
