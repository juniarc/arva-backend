from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Category(db.Model):
    __tablename__ = "categories"
    category_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    category_name = db.Column(db.String(120), unique=True, nullable=False)

    #akses ke table category_products
    # product_category = relationship("CategoryProductAssociation", back_populates="category")

    #akses ke table products
    # product = relationship("Product", secondary="category_products_association", back_populates="category")

    def __repr__(self):
        return f"<Category {self.category_name} {self.category_id}>"
    
    def to_dict(self):
        return {
            'category_id': self.category_id,
            'category_name': self.category_name,
        }

    