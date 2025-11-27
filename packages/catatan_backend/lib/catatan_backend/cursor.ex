defmodule CatatanBackend.Cursor do
  @type t :: %__MODULE__{
          x: non_neg_integer(),
          y: non_neg_integer()
        }

  @derive Jason.Encoder
  defstruct x: 0, y: 0

  @spec initialize :: t
  def initialize do
    %__MODULE__{
      x: 0,
      y: 0
    }
  end

  @spec set_position(t, non_neg_integer(), non_neg_integer()) :: t
  def set_position(cursor, x, y) do
    %{cursor | x: x, y: y}
  end
end
