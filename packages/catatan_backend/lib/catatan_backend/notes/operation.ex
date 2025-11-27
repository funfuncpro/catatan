defmodule CatatanBackend.Notes.Operation do
  @type t :: %__MODULE__{
          operation: atom(),
          data: String.t() | nil,
          index: %{
            start: integer(),
            end: integer()
          }
        }

  defstruct [:operation, :data, :index]
end
