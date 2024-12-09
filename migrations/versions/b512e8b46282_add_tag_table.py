"""add tag table

Revision ID: b512e8b46282
Revises: 8b8c05bc9461
Create Date: 2024-12-08 16:02:11.196639

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b512e8b46282'
down_revision = '8b8c05bc9461'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('tags',
    sa.Column('tag_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('tag_name', sa.String(length=120), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.PrimaryKeyConstraint('tag_id'),
    sa.UniqueConstraint('tag_name')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('tags')
    # ### end Alembic commands ###
