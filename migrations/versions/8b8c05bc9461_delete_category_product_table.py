"""delete category_product_table

Revision ID: 8b8c05bc9461
Revises: b0e40efaa574
Create Date: 2024-12-06 23:26:50.346329

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8b8c05bc9461'
down_revision = 'b0e40efaa574'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('category_products_association')
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(None, 'categories', ['category_id'], ['category_id'])

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('category_id')

    op.create_table('category_products_association',
    sa.Column('category_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('product_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.category_id'], name='category_products_association_category_id_fkey', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.product_id'], name='category_products_association_product_id_fkey', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('category_id', 'product_id', name='category_products_association_pkey')
    )
    # ### end Alembic commands ###
