defmodule CatatanBackendWeb.NotesValidator do
  import Ecto.Changeset
  alias CatatanBackendWeb.Error

  @doc """
  Validates the parameters for creating a note.
  No parameters required - notes start empty and content is added via YATA operations.
  """
  @spec validate_notes_creation(map) :: {:ok, map}
  def validate_notes_creation(_params) do
    {:ok, %{}}
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

  @doc """
  Validates the payload for cursor_move channel event.
  Expects a map with required :after_element (element ID or null) and optional :offset.
  """
  @spec validate_cursor_move(map()) :: {:ok, map()} | {:error, map()}
  def validate_cursor_move(params) do
    types = %{
      after_element: {:array, :any},
      offset: :integer
    }

    {%{}, types}
    |> cast(params, [:after_element, :offset])
    |> validate_element_id(:after_element)
    |> validate_number(:offset, greater_than_or_equal_to: 0)
    |> case do
      %Ecto.Changeset{valid?: true} = changeset ->
        changes = %{
          after_element: parse_element_id(get_change(changeset, :after_element)),
          offset: get_change(changeset, :offset) || 0
        }

        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @doc """
  Validates the payload for insert channel event.
  Expects a map with required :content, and optional :origin and :right_origin keys.
  """
  @spec validate_insert(map()) :: {:ok, map()} | {:error, map()}
  def validate_insert(params) do
    types = %{
      content: :string,
      origin: {:array, :any},
      right_origin: {:array, :any}
    }

    {%{}, types}
    |> cast(params, [:content, :origin, :right_origin], empty_values: [])
    |> validate_required([:content])
    |> validate_element_id(:origin)
    |> validate_element_id(:right_origin)
    |> case do
      %Ecto.Changeset{valid?: true} = changeset ->
        changes = %{
          content: get_change(changeset, :content),
          origin: parse_element_id(get_change(changeset, :origin)),
          right_origin: parse_element_id(get_change(changeset, :right_origin))
        }

        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @doc """
  Validates the payload for delete channel event.
  Expects a map with required :element_id key.
  """
  @spec validate_delete(map()) :: {:ok, map()} | {:error, map()}
  def validate_delete(params) do
    types = %{element_id: :string}

    {%{}, types}
    |> cast(params, [:element_id])
    |> validate_required([:element_id])
    |> validate_length(:element_id, min: 1, max: 255)
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  @doc """
  Validates the payload for sync channel event.
  Expects a map with required :state_vector key.
  """
  @spec validate_sync(map()) :: {:ok, map()} | {:error, map()}
  def validate_sync(params) do
    types = %{state_vector: :map}

    {%{}, types}
    |> cast(params, [:state_vector])
    |> validate_required([:state_vector])
    |> case do
      %Ecto.Changeset{valid?: true, changes: changes} ->
        {:ok, changes}

      %Ecto.Changeset{valid?: false, errors: errors} ->
        {:error, Error.format_ecto_error(errors)}
    end
  end

  # Private helper to validate element_id format [writer_id, clock]
  defp validate_element_id(changeset, field) do
    validate_change(changeset, field, fn _field, value ->
      case value do
        nil ->
          []

        [writer_id, clock] when is_binary(writer_id) and is_integer(clock) and clock >= 0 ->
          []

        _ ->
          [
            {field,
             "must be [writer_id, clock] where writer_id is a string and clock is a non-negative integer"}
          ]
      end
    end)
  end

  # Parse element_id from array format to tuple format
  defp parse_element_id(nil), do: nil

  defp parse_element_id([writer_id, clock]) when is_binary(writer_id) and is_integer(clock) do
    {writer_id, clock}
  end

  defp parse_element_id(_), do: nil
end
