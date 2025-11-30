defmodule CatatanBackend.Actor.Writer do
  alias CatatanBackend.GenerateID
  alias CatatanBackend.Cursor

  @type permission :: %{required(:write) => boolean()}

  @type user_profile :: %{
          required(:id) => String.t(),
          required(:name) => String.t(),
          required(:permission) => permission()
        }

  @type t :: %__MODULE__{
          id: String.t(),
          name: String.t(),
          permission: permission(),
          cursor: Cursor.t()
        }

  @derive Jason.Encoder
  defstruct [:id, :name, :permission, :cursor]

  @spec initialize_actor(user_profile()) :: t()
  def initialize_actor(
        %{
          id: id,
          name: name,
          permission: permission
        } = _user_info
      ) do
    %__MODULE__{
      id: id,
      name: name,
      permission: permission,
      cursor: Cursor.initialize()
    }
  end

  @spec initialize_actor :: t()
  def initialize_actor do
    %__MODULE__{
      id: GenerateID.generate_nano_id(),
      name: generate_name(),
      permission: %{
        write: true
      },
      cursor: Cursor.initialize()
    }
  end

  @doc """
  Update cursor position of a writer using YATA element references.

  ## Parameters
    - writer: The writer struct
    - after_element: The element ID the cursor is positioned after, or nil for document start
    - offset: Character offset within the element (default 0)
  """
  @spec update_cursor_position(t(), Cursor.element_id(), non_neg_integer()) :: t()
  def update_cursor_position(writer, after_element, offset \\ 0) do
    new_cursor = Cursor.set_position(writer.cursor, after_element, offset)
    %{writer | cursor: new_cursor}
  end

  defp generate_name() do
    "user_#{GenerateID.generate_nano_id(4)}"
  end
end
