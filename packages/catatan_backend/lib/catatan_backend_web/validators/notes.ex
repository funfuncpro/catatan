defmodule CatatanBackendWeb.NotesValidator do
  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a note.
  Expects a map with optional :content key.
  """
  @spec validate_notes_creation(map) :: {:ok, map} | {:error, keyword()}
  def validate_notes_creation(params) do
    types = %{
      content: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @spec validate_notes_update(map) :: {:ok, map} | {:error, keyword()}
  def validate_notes_update(params) do
    types = %{
      id: :string,
      content: :string
    }

    {%{}, types}
    |> cast(params, Map.keys(types))
    |> validate_required([:id])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @doc """
  Validates a note ID for channel operations.
  Expects a string with minimum 1 and maximum 255 characters.
  """
  @spec validate_note_id(String.t()) :: {:ok, String.t()} | {:error, map()}
  def validate_note_id(note_id) when is_binary(note_id) do
    types = %{id: :string}

    {%{}, types}
    |> cast(%{id: note_id}, [:id])
    |> validate_required([:id])
    |> validate_length(:id, min: 1, max: 255)
    |> case do
      %Ecto.Changeset{valid?: true, changes: %{id: id}} ->
        {:ok, id}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  def validate_note_id(_), do: {:error, %{id: "must be a string"}}

  @doc """
  Validates the payload for setting note body via channel.
  Expects a map with required :body key (string, max 1MB).
  """
  @spec validate_set_body(map()) :: {:ok, map()} | {:error, map()}
  def validate_set_body(params) do
    types = %{body: :string}

    {%{}, types}
    |> cast(params, [:body])
    |> validate_required([:body])
    |> validate_length(:body, max: 1_000_000)
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end
end
