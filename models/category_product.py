from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class CategoryProductAssociation(db.Model):
    __tablename__ = "category_products_association"
    category_id = db.Column(db.Integer, ForeignKey('categories.category_id'), nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id'), nullable=False)

    #relasi ke model product dan category
    # product= relationship("Product", back_populates="category_product", lazy=True)

    # category = relationship("Category", back_populates="product_category", lazy=True)

    def __repr__(self):
        return f"<CategoryProduct {self.category_id} {self.product_id}>"    

    def to_dict(self):
        return {
            'category_id': self.category_id,
            'product_id': self.product_id,
        }
