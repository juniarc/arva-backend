"""add productshop table

Revision ID: 5fd728098b78
Revises: adc4fdff019f
Create Date: 2024-12-03 22:06:41.918257

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5fd728098b78'
down_revision = 'adc4fdff019f'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('shops',
    sa.Column('shop_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('shop_name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('shop_image', sa.Text(), nullable=True),
    sa.Column('shop_address_street', sa.Text(), nullable=False),
    sa.Column('shop_address_province', sa.String(length=120), nullable=False),
    sa.Column('shop_address_city', sa.String(length=120), nullable=False),
    sa.Column('shop_address_district', sa.String(length=120), nullable=False),
    sa.Column('shop_address_subdistrict', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ),
    sa.PrimaryKeyConstraint('shop_id'),
    sa.UniqueConstraint('shop_name')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('shops')
    # ### end Alembic commands ###
